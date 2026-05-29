import { Vec2 } from '@/math/Vec2';
import type { Poolable } from '@/core/ObjectPool';

/**
 * A static capsule collider: the inflated line segment that every wall, ramp,
 * and bumper boundary is built from. Pooled and reconfigured by the level
 * streamer as chunks scroll past, never destroyed.
 */
export class Segment implements Poolable {
  readonly a = new Vec2();
  readonly b = new Vec2();
  radius = 0.4;
  restitution = 0.55;
  friction = 0.04;
  active = false;
  /** Optional tag used by the renderer to colour the mesh (ramp vs wall). */
  kind: 'wall' | 'ramp' | 'bumper' = 'wall';

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
  }
}
