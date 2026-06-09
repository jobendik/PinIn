import { Vec2 } from '@/math/Vec2';
import type { Poolable } from '@/core/ObjectPool';
export class CircleCollider implements Poolable {
  readonly center = new Vec2();
  radius = 1.4;
  restitution = 1.18;
  friction = 0.02;
  active = false;
  set(x: number, y: number, radius: number): this { this.center.set(x, y); this.radius = radius; return this; }
  reset(): void { this.active = true; }
  recycle(): void { this.active = false; }
}
