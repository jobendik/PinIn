import { Vec2 } from '@/math/Vec2';
import { Config } from '@/config/GameConfig';

/** The player-controlled pinball: a dynamic circle body. */
export class Ball {
  readonly position = new Vec2();
  readonly velocity = new Vec2();
  /** Previous fixed-step position, kept for render interpolation. */
  readonly prevPosition = new Vec2();
  readonly radius = Config.ball.radius;
  mass = Config.ball.mass;
  /** Highest Y ever reached — drives distance/score and one-shot checkpoints. */
  maxY = 0;

  reset(x: number, y: number): void {
    this.position.set(x, y);
    this.prevPosition.set(x, y);
    this.velocity.set(0, 0);
    this.maxY = y;
  }

  /** Clamp speed so the swept solver always has a well-conditioned motion. */
  clampSpeed(): void {
    const speedSq = this.velocity.lengthSq();
    const max = Config.ball.maxSpeed;
    if (speedSq > max * max) {
      this.velocity.scaleSelf(max / Math.sqrt(speedSq));
    }
  }
}
