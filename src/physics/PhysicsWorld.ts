import { Vec2 } from '@/math/Vec2';
import { Config } from '@/config/GameConfig';
import { Ball } from './Ball';
import { Flipper } from './Flipper';
import { Segment } from './Segment';
import { CircleCollider } from './CircleCollider';
import { sweepCircleSegment, sweepCircleCircle, resolveBounce, type SweepHit } from './collision';
import { bus } from '@/core/EventBus';

/** Only colliders whose Y is within this band of the ball get a full sweep. */
const BROADPHASE_Y = 34;

type AugmentedHit = SweepHit & {
  restitution: number;
  friction: number;
  surfaceVel: Vec2;
  tipBoost: number;
  /** Slingshot snap impulse along the contact normal (0 for inert geometry). */
  kick: number;
  /** Vertical lift for a climbing ball — a powered ramp (0 for inert geometry). */
  kickUp: number;
};

/**
 * The fixed-step 2D physics world.
 *
 * Each `step()` advances the flippers, integrates gravity, and moves the ball
 * with iterative swept collision against all active segments and both flippers.
 * Sweeping the full motion (rather than discrete overlap tests) is what makes a
 * tiny ball reliably bounce off a fast flipper instead of tunneling through it.
 */
export class PhysicsWorld {
  readonly ball = new Ball();
  readonly flippers: Flipper[] = [];
  /** Active static colliders. The level streamer owns the backing pool. */
  readonly segments = new Set<Segment>();
  readonly bumpers = new Set<CircleCollider>();
  /** Optional time-scale (Slow Motion power-up scales the whole sim). */
  timeScale = 1;

  private gravity = Config.physics.gravity;

  // Auto-nudge bookkeeping.
  private stuckTimer = 0;
  private readonly stuckAnchor = new Vec2();

  addFlipper(flipper: Flipper): void {
    this.flippers.push(flipper);
  }

  addSegment(seg: Segment): void {
    this.segments.add(seg);
  }

  removeSegment(seg: Segment): void {
    this.segments.delete(seg);
  }

  clearSegments(): void {
    this.segments.clear();
  }

  addBumper(b: CircleCollider): void {
    this.bumpers.add(b);
  }

  removeBumper(b: CircleCollider): void {
    this.bumpers.delete(b);
  }

  step(dt: number): void {
    const scaledDt = dt * this.timeScale;
    if (scaledDt <= 0) return;

    for (const flipper of this.flippers) flipper.step(scaledDt);

    const ball = this.ball;
    ball.prevPosition.copy(ball.position);

    // Integrate gravity (toward -Y, down the canyon).
    ball.velocity.y -= this.gravity * scaledDt;
    ball.clampSpeed();

    this.integrateWithCCD(scaledDt);

    // Track best height for distance/score and one-shot checkpoints.
    if (ball.position.y > ball.maxY) ball.maxY = ball.position.y;

    this.updateNudge(scaledDt);
  }

  /**
   * Move the ball by velocity·dt, resolving the earliest contact and continuing
   * with the remaining time. Capped iterations keep a corner pile-up bounded.
   */
  private integrateWithCCD(dt: number): void {
    const ball = this.ball;
    let remaining = dt;

    for (let iter = 0; iter < 6 && remaining > 1e-6; iter++) {
      const motion = ball.velocity.scale(remaining);
      const hit = this.firstHit(ball.position, ball.radius, motion);

      if (!hit) {
        ball.position.addSelf(motion);
        break;
      }

      // Advance to just before the contact (small skin to avoid re-penetration).
      const travel = Math.max(0, hit.t - 1e-4);
      ball.position.addScaledSelf(motion, travel);

      // Resolve the bounce in the collider's frame.
      ball.velocity.copy(
        resolveBounce(ball.velocity, hit.normal, hit.restitution, hit.friction, hit.surfaceVel),
      );

      // A flipper tip swinging into the ball gets an extra punch for snappy feel.
      if (hit.tipBoost > 0) {
        ball.velocity.addScaledSelf(hit.normal, hit.tipBoost);
      }
      // A slingshot snaps the ball back into play along the contact normal.
      if (hit.kick > 0) {
        ball.velocity.addScaledSelf(hit.normal, hit.kick);
      }
      // A powered ramp carries a *climbing* ball up the canyon. Only assists a
      // ball that is already rising (or barely falling), so it lifts a weak shot
      // hugging the funnel toward the gate but never flings a draining ball. The
      // ball's maxSpeed clamp (below) is the hard ceiling that keeps swept
      // collision reliable, so the lift can never pump the ball into a tunnel.
      if (hit.kickUp > 0 && ball.velocity.y > -1) {
        ball.velocity.y += hit.kickUp;
      }
      ball.clampSpeed();

      bus.emit('ball:collide', {
        speed: ball.velocity.length(),
        nx: hit.normal.x,
        ny: hit.normal.y,
        x: hit.point.x,
        y: hit.point.y,
      });

      remaining *= 1 - Math.max(travel, 0);
      // Nudge the ball off the surface a touch to prevent sticking.
      ball.position.addScaledSelf(hit.normal, 1e-3);
    }
  }

  /** Find the earliest contact among segments and flippers for this motion. */
  private firstHit(p: Vec2, r: number, motion: Vec2): AugmentedHit | null {
    let best: AugmentedHit | null = null;

    const by = p.y;
    for (const seg of this.segments) {
      if (!seg.active) continue;
      // One-way energy gate: a ratchet. Passable while the ball travels up the
      // canyon (or horizontally), solid only while it is clearly falling back —
      // so a missed shot can drop onto the flippers but never below the board.
      if (seg.oneWayY > 0 && motion.y > -1e-4) continue;
      // Cheap broadphase: skip colliders far from the ball's Y band.
      if (Math.min(seg.a.y, seg.b.y) > by + BROADPHASE_Y) continue;
      if (Math.max(seg.a.y, seg.b.y) < by - BROADPHASE_Y) continue;
      const hit = sweepCircleSegment(p, r, motion, seg.a, seg.b, seg.radius);
      if (hit && (!best || hit.t < best.t)) {
        best = {
          ...hit,
          restitution: seg.restitution,
          friction: seg.friction,
          surfaceVel: Vec2.zero(),
          tipBoost: 0,
          kick: seg.kick,
          kickUp: seg.kickUp,
        };
      }
    }

    for (const bumper of this.bumpers) {
      if (!bumper.active) continue;
      if (Math.abs(bumper.center.y - by) > BROADPHASE_Y) continue;
      const hit = sweepCircleCircle(p, r, motion, bumper.center, bumper.radius);
      if (hit && (!best || hit.t < best.t)) {
        best = {
          ...hit,
          restitution: bumper.restitution,
          friction: bumper.friction,
          surfaceVel: Vec2.zero(),
          tipBoost: 0,
          kick: 0,
          kickUp: 0,
        };
      }
    }

    for (const flipper of this.flippers) {
      if (!flipper.active) continue;
      const hit = sweepCircleSegment(p, r, motion, flipper.pivot, flipper.tip, flipper.radius);
      if (hit && (!best || hit.t < best.t)) {
        const surfaceVel = flipper.surfaceVelocityAt(hit.point);
        // Only boost when the flipper is actively swinging up into the ball.
        const swinging = flipper.pressed && Math.abs(flipper.angularVelocity) > 0.5;
        best = {
          ...hit,
          restitution: flipper.restitution,
          friction: flipper.friction,
          surfaceVel,
          tipBoost: swinging ? Config.flipper.tipBoost : 0,
          kick: 0,
          kickUp: 0,
        };
      }
    }

    return best;
  }

  /**
   * Auto-nudge: if the ball barely moves for `stuckSeconds`, apply a small
   * random impulse to dislodge it (blueprint §Dynamic Obstacles).
   */
  private updateNudge(dt: number): void {
    const ball = this.ball;
    const moved = ball.position.distanceTo(this.stuckAnchor);
    if (moved > Config.nudge.positionEpsilon) {
      this.stuckAnchor.copy(ball.position);
      this.stuckTimer = 0;
      return;
    }
    this.stuckTimer += dt;
    if (this.stuckTimer >= Config.nudge.stuckSeconds) {
      // Pseudo-random but deterministic direction from the ball's position.
      const seed = (ball.position.x * 12.9898 + ball.position.y * 78.233) % (Math.PI * 2);
      const dir = Vec2.fromAngle(seed, Config.nudge.impulse);
      dir.y = Math.abs(dir.y); // bias upward to help progress
      ball.velocity.addSelf(dir);
      this.stuckTimer = 0;
      this.stuckAnchor.copy(ball.position);
      bus.emit('ball:nudge', undefined);
    }
  }

  resetNudge(): void {
    this.stuckTimer = 0;
    this.stuckAnchor.copy(this.ball.position);
  }
}
