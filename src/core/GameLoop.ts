import { Config } from '@/config/GameConfig';

export interface LoopCallbacks {
  /** Fixed-step simulation tick. Called 0..maxSubSteps times per frame. */
  fixedUpdate: (dt: number) => void;
  /** Variable-step visual update (camera, trails, UI). `alpha` ∈ [0,1] is the
   * interpolation factor between the last two physics states. */
  render: (alpha: number, frameDt: number) => void;
}

/**
 * Decouples the WebGL renderer from the physics solver (blueprint §HTML5
 * Optimization). Physics always advances in fixed `Config.physics.fixedDt`
 * increments so trajectories are deterministic regardless of display FPS; if a
 * visual frame runs long, the loop catches up with multiple sub-steps (capped
 * to avoid the spiral of death).
 */
export class GameLoop {
  private readonly fixedDt = Config.physics.fixedDt;
  private readonly maxSubSteps = Config.physics.maxSubSteps;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    // Clamp the wall-clock delta so a backgrounded tab doesn't dump a huge
    // accumulator and freeze the device catching up.
    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameDt > 0.25) frameDt = 0.25;

    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxSubSteps) {
      this.callbacks.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    // If we hit the sub-step cap, shed the remaining backlog so we don't lag.
    if (steps === this.maxSubSteps) this.accumulator = 0;

    const alpha = this.accumulator / this.fixedDt;
    this.callbacks.render(alpha, frameDt);
  };
}
