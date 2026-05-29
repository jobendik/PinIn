import { Vec2 } from '@/math/Vec2';

/**
 * Continuous collision detection primitives.
 *
 * Pinball is the canonical tunneling failure case: a small fast ball versus a
 * fast-rotating flipper (blueprint §Kinematic Physics). Rather than relying on
 * discrete overlap tests, we sweep the ball's swept path against capsule-shaped
 * colliders (a line segment inflated by a radius) and resolve at the time of
 * impact. This is the same guarantee Rapier's CCD gives, implemented directly.
 */

export interface SweepHit {
  /** Fraction of the attempted motion travelled before impact, in [0,1]. */
  t: number;
  /** Unit surface normal at the contact, pointing toward the ball. */
  normal: Vec2;
  /** Contact point in world space. */
  point: Vec2;
}

/** Closest point on segment AB to point P, plus the parametric coordinate. */
export function closestPointOnSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2,
): { point: Vec2; s: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let s = lenSq > 1e-9 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq : 0;
  s = s < 0 ? 0 : s > 1 ? 1 : s;
  return { point: new Vec2(a.x + abx * s, a.y + aby * s), s };
}

/** Time of impact of a ray P + t·D against a circle (centre C, radius R). */
function rayCircleToi(p: Vec2, d: Vec2, c: Vec2, r: number): number {
  const mx = p.x - c.x;
  const my = p.y - c.y;
  const a = d.x * d.x + d.y * d.y;
  if (a < 1e-12) return -1;
  const b = 2 * (mx * d.x + my * d.y);
  const cc = mx * mx + my * my - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t;
}

/**
 * Sweep a circle of radius `ballR` starting at `p`, moving by `d`, against a
 * line segment (A→B) inflated by `segR`. Returns the earliest contact in the
 * motion, or null if none. Also resolves the already-penetrating case (t = 0).
 */
export function sweepCircleSegment(
  p: Vec2,
  ballR: number,
  d: Vec2,
  a: Vec2,
  b: Vec2,
  segR: number,
): SweepHit | null {
  const R = ballR + segR;

  // --- Already overlapping? Resolve immediately with a push-out normal. ---
  const start = closestPointOnSegment(p, a, b);
  const startDx = p.x - start.point.x;
  const startDy = p.y - start.point.y;
  const startDistSq = startDx * startDx + startDy * startDy;
  if (startDistSq < R * R - 1e-4) {
    const dist = Math.sqrt(startDistSq) || 1e-6;
    const normal = new Vec2(startDx / dist, startDy / dist);
    return { t: 0, normal, point: start.point };
  }

  let best = Number.POSITIVE_INFINITY;
  let bestNormal: Vec2 | null = null;
  let bestPoint: Vec2 | null = null;

  // --- Slab (flat face) test in segment-local coordinates. ---
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const segLen = Math.hypot(ex, ey);
  if (segLen > 1e-6) {
    const ux = ex / segLen;
    const uy = ey / segLen;
    const nx = -uy; // perpendicular
    const ny = ux;

    const relx = p.x - a.x;
    const rely = p.y - a.y;
    const d0 = relx * nx + rely * ny; // signed perpendicular distance
    const vn = d.x * nx + d.y * ny; // perpendicular speed

    if (Math.abs(vn) > 1e-9) {
      const side = d0 >= 0 ? 1 : -1;
      const t = (side * R - d0) / vn;
      if (t >= 0 && t <= 1) {
        const sx = p.x + d.x * t - a.x;
        const sy = p.y + d.y * t - a.y;
        const along = sx * ux + sy * uy;
        if (along >= 0 && along <= segLen) {
          best = t;
          bestNormal = new Vec2(side * nx, side * ny);
          bestPoint = new Vec2(a.x + ux * along, a.y + uy * along);
        }
      }
    }
  }

  // --- Endpoint cap tests (the rounded ends of the capsule). ---
  for (const cap of [a, b]) {
    const t = rayCircleToi(p, d, cap, R);
    if (t >= 0 && t <= 1 && t < best) {
      const hx = p.x + d.x * t;
      const hy = p.y + d.y * t;
      let nx = hx - cap.x;
      let ny = hy - cap.y;
      const len = Math.hypot(nx, ny) || 1e-6;
      nx /= len;
      ny /= len;
      best = t;
      bestNormal = new Vec2(nx, ny);
      bestPoint = new Vec2(cap.x, cap.y);
    }
  }

  if (bestNormal && bestPoint && best <= 1) {
    return { t: best, normal: bestNormal, point: bestPoint };
  }
  return null;
}

/**
 * Reflect an incoming velocity about a contact normal with restitution and
 * tangential friction. `surfaceVel` is the velocity of the contact point on a
 * moving collider (e.g. a flipper face) — supplying it lets a swinging flipper
 * impart kinetic energy to the ball.
 */
export function resolveBounce(
  velocity: Vec2,
  normal: Vec2,
  restitution: number,
  friction: number,
  surfaceVel: Vec2 = Vec2.zero(),
): Vec2 {
  // Work in the collider's reference frame.
  const rel = velocity.sub(surfaceVel);
  const vn = rel.dot(normal);
  if (vn >= 0) {
    // Already separating — leave velocity untouched.
    return velocity.clone();
  }
  const normalImpulse = normal.scale(-(1 + restitution) * vn);
  // Tangential (friction) component.
  const tangent = new Vec2(-normal.y, normal.x);
  const vt = rel.dot(tangent);
  const frictionImpulse = tangent.scale(-vt * friction);
  return rel.add(normalImpulse).add(frictionImpulse).add(surfaceVel);
}
