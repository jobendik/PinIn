/**
 * A small, allocation-conscious 2D vector.
 *
 * The physics world runs at a fixed step and touches these vectors thousands of
 * times per frame, so most operations come in two flavours: an immutable form
 * that returns a fresh vector, and a mutating `*Self` form used inside hot loops
 * to avoid garbage-collector pressure (see blueprint §HTML5 Optimization).
 */
export class Vec2 {
  constructor(public x = 0, public y = 0) {}

  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  static fromAngle(angle: number, length = 1): Vec2 {
    return new Vec2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: Vec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  add(v: Vec2): Vec2 {
    return new Vec2(this.x + v.x, this.y + v.y);
  }

  addSelf(v: Vec2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  addScaledSelf(v: Vec2, s: number): this {
    this.x += v.x * s;
    this.y += v.y * s;
    return this;
  }

  sub(v: Vec2): Vec2 {
    return new Vec2(this.x - v.x, this.y - v.y);
  }

  subSelf(v: Vec2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }

  scaleSelf(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  dot(v: Vec2): number {
    return this.x * v.x + this.y * v.y;
  }

  /** 2D cross product (returns the scalar z-component). */
  cross(v: Vec2): number {
    return this.x * v.y - this.y * v.x;
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  normalize(): Vec2 {
    const len = this.length();
    return len > 1e-9 ? new Vec2(this.x / len, this.y / len) : new Vec2(0, 0);
  }

  normalizeSelf(): this {
    const len = this.length();
    if (len > 1e-9) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  /** Left-hand perpendicular (rotate +90°). */
  perp(): Vec2 {
    return new Vec2(-this.y, this.x);
  }

  /** Rotate around the origin by `angle` radians. */
  rotate(angle: number): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }

  /** Reflect this vector about a unit normal `n` with a restitution factor. */
  reflect(n: Vec2, restitution = 1): Vec2 {
    const d = this.dot(n) * (1 + restitution);
    return new Vec2(this.x - d * n.x, this.y - d * n.y);
  }

  distanceTo(v: Vec2): number {
    return Math.sqrt(this.distanceSqTo(v));
  }

  distanceSqTo(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }
}
