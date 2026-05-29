import { Vec2 } from '@/math/Vec2';
import { Config } from '@/config/GameConfig';
import { approach } from '@/math/MathUtils';

/**
 * A torque-driven flipper modelled as a rotating capsule pinned at `pivot`.
 *
 * Per the blueprint: near-zero coil ramp-up (the flipper snaps to its target
 * angle at a high angular speed), restitution ≈ 0.88, high friction for
 * cradling, and an effectively infinite mass so the ball never deflects the
 * stroke. The swung surface imparts velocity to the ball at the contact point.
 */
export class Flipper {
  readonly pivot = new Vec2();
  readonly side: 'left' | 'right';
  readonly length = Config.flipper.length;
  readonly radius = Config.flipper.width * 0.5;
  readonly restitution = Config.flipper.restitution;
  readonly friction = Config.flipper.friction;

  /** Resting and actuated angles (radians, in world space for this side). */
  private readonly restAngle: number;
  private readonly upAngle: number;
  /** Current angle and the previous-step angle (for angular velocity). */
  angle: number;
  private prevAngle: number;
  angularVelocity = 0;
  pressed = false;
  /** When false the flipper is off-screen/pooled and skipped by the solver. */
  active = false;

  /** Live tip position, recomputed each step. */
  readonly tip = new Vec2();

  constructor(side: 'left' | 'right', pivotX: number, pivotY: number) {
    this.side = side;
    this.pivot.set(pivotX, pivotY);

    const rest = (Config.flipper.restAngleDeg * Math.PI) / 180;
    const up = (Config.flipper.upAngleDeg * Math.PI) / 180;
    if (side === 'left') {
      // Left flipper hinges on the left, sweeps up to the right.
      this.restAngle = rest;
      this.upAngle = up;
    } else {
      // Right flipper is mirrored: it points up-left and sweeps the other way.
      this.restAngle = Math.PI - rest;
      this.upAngle = Math.PI - up;
    }
    this.angle = this.restAngle;
    this.prevAngle = this.restAngle;
    this.updateTip();
  }

  setPivot(x: number, y: number): void {
    this.pivot.set(x, y);
    this.updateTip();
  }

  press(down: boolean): void {
    this.pressed = down;
  }

  /** Advance the flipper toward its target angle at the configured speed. */
  step(dt: number): void {
    if (!this.active) return;
    this.prevAngle = this.angle;
    const target = this.pressed ? this.upAngle : this.restAngle;
    const maxDelta = Config.flipper.angularSpeed * dt;
    this.angle = approach(this.angle, target, maxDelta);
    // Wrap-safe angular velocity (angles here stay within a small arc).
    this.angularVelocity = (this.angle - this.prevAngle) / dt;
    this.updateTip();
  }

  private updateTip(): void {
    this.tip.set(
      this.pivot.x + Math.cos(this.angle) * this.length,
      this.pivot.y + Math.sin(this.angle) * this.length,
    );
  }

  /** Velocity of the flipper surface at world point `q` (ω × r). */
  surfaceVelocityAt(q: Vec2): Vec2 {
    const rx = q.x - this.pivot.x;
    const ry = q.y - this.pivot.y;
    // 2D: v = ω * perp(r) = ω * (-ry, rx)
    return new Vec2(-ry * this.angularVelocity, rx * this.angularVelocity);
  }
}
