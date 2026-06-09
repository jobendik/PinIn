import { Vec2 } from '@/math/Vec2';
import type { Poolable } from '@/core/ObjectPool';

/**
 * A static capsule collider: the inflated line segment that every wall, ramp,
 * slingshot, and one-way gate is built from. Pooled and reconfigured by the
 * level streamer as chunks scroll past, never destroyed.
 */
export class Segment implements Poolable {
  readonly a = new Vec2();
  readonly b = new Vec2();
  radius = 0.4;
  restitution = 0.55;
  friction = 0.04;
  /** Extra impulse imparted along the contact normal — slingshot "snap". */
  kick = 0;
  /**
   * Vertical lift (u/s) added to a *climbing* ball on contact — a powered ramp
   * carrying it up the canyon. 0 for inert geometry.
   */
  kickUp = 0;
  /**
   * One-way behaviour along world-Y:
   *   0  → solid both ways
   *  +1  → passable while travelling UP the canyon, solid while falling back
   * This is what turns a board boundary into a ratchet so a missed shot can
   * only drop the ball back onto its own flippers, never below the board.
   */
  oneWayY = 0;
  active = false;
  /** Tag used by the renderer to colour/shape the mesh. */
  kind: 'wall' | 'ramp' | 'bumper' | 'sling' | 'gate' = 'wall';

  set(ax: number, ay: number, bx: number, by: number): this {
    this.a.set(ax, ay);
    this.b.set(bx, by);
    return this;
  }

  reset(): void {
    this.active = true;
  }

  recycle(): void {
    this.active = false;
    this.kick = 0;
    this.kickUp = 0;
    this.oneWayY = 0;
  }
}
