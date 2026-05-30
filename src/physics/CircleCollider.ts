import { Vec2 } from '@/math/Vec2';
import type { Poolable } from '@/core/ObjectPool';

/**
 * A static circular collider — the pinball "pop bumper". Pooled and
 * repositioned by the level streamer like every other piece of table geometry.
 */
export class CircleCollider implements Poolable {
  readonly center = new Vec2();
  radius = 1.4;
  restitution = 1.15; // lively kick, like a real pop bumper
  friction = 0.02;
  active = false;

  set(x: number, y: number, radius: number): this {
    this.center.set(x, y);
    this.radius = radius;
    return this;
  }

  reset(): void {
    this.active = true;
  }

  recycle(): void {
    this.active = false;
  }
}
