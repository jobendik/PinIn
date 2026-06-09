// src/config/GameConfig.ts
var Config = {
  /** Fixed-timestep simulation cadence (see blueprint §HTML5 Optimization). */
  physics: {
    fixedDt: 1 / 120,
    // 120 Hz solver for crisp, deterministic ballistics
    maxSubSteps: 8,
    // cap catch-up iterations to avoid the "spiral of death"
    gravity: 31,
    // world units / s^2, pulling toward -Y (down the canyon)
    velocityIterations: 12,
    // blueprint recommends 10–15
    positionIterations: 4,
    ccdMinTravel: 0.35
    // swept collision kicks in when travel exceeds ball radius * this
  },
  ball: {
    radius: 0.9,
    mass: 1,
    restitution: 0.55,
    // walls/ramps have their own per-kind values (railProps)
    friction: 0.04,
    // low rolling friction so momentum carries up ramps
    maxSpeed: 108,
    // hard clamp to keep CCD reliable (swept, so this is safe)
    trailLength: 40
  },
  /**
   * Flipper kinematics. The blueprint calls for ~2000–3300 torque, near-zero
   * coil ramp-up, restitution ≈ 0.88, high friction ≈ 0.9 for cradling, and an
   * effectively infinite flipper mass so the ball never deflects the stroke.
   */
  flipper: {
    length: 4.8,
    // ~1/4 of the lane width, like a real table — short enough that
    // the tips leave an open central drain instead of sealing the channel
    width: 1,
    restitution: 0.9,
    friction: 0.9,
    restAngleDeg: -32,
    // resting (down) angle relative to mount, for the LEFT flipper
    upAngleDeg: 38,
    // actuated (up) angle relative to mount
    angularSpeed: 27,
    // rad/s — snappy but with a catchable upswing window
    tipBoost: 30
    // extra impulse a flipper swinging into the ball imparts — authoritative shots
  },
  /**
   * The launcher is a pinball PLUNGER, not a free elevator. It only re-serves
   * a ball that has drained to the bottom of a board: a firm-but-finite kick that
   * puts the ball back into play among the bumpers. Climbing a board to its gate
   * is the flippers' job — a plunge alone never clears one. (See Game.ts.)
   */
  launch: {
    plungeSpeed: 36,
    // u/s re-serve kick — reaches ~half a board, never clears one
    aimX: 9,
    // lateral component, biased toward the side opposite the tap
    captureSpeed: 7,
    // u/s — below this the ball counts as "settled"
    captureDelay: 0.3,
    // s of settling before the plunger re-arms
    captureMaxLocalY: 12
    // ball must be this far (world-units) up its board to count as "low"
  },
  /** The temporal economy — time is the only currency (blueprint §Temporal Economy). */
  time: {
    start: 60,
    // seconds on the master clock at run start
    dotBonus: 1,
    // +1s per Extra Time Dot
    checkpointBonus: 25,
    // +25s per checkpoint crossing
    dangerThreshold: 8,
    // HUD turns red / pulses below this
    overtimeDistance: 8e3
    // dots & power-ups purge beyond this (Overtime)
  },
  /** Auto-nudge: dislodge a stuck ball after this many seconds of near-zero motion. */
  nudge: {
    stuckSeconds: 3,
    positionEpsilon: 0.6,
    // movement under this (per window) counts as "stuck"
    impulse: 14
  },
  /**
   * Forced-perspective camera up an INCLINED playfield (blueprint §Rendering /
   * pinout.md). Lower + closer than a top-down table view: the PinOut read is a
   * 3/4 chase shot that compresses the canyon ahead into glowing depth.
   */
  camera: {
    followLambda: 4.5,
    tilt: 0.66,
    height: 11,
    back: 15,
    lookAhead: 26,
    fov: 58
  },
  /**
   * Selective-bloom configuration for the neon synthwave look. Threshold keeps
   * the dark canyon crisp; strength is what makes the rails *burn*.
   */
  bloom: {
    threshold: 0.82,
    strength: 0.95,
    radius: 0.45,
    exposure: 1.05
  },
  level: {
    chunkHeight: 40,
    // world-units per board: short enough that a clean flip can clear it
    spawnAheadChunks: 3,
    // keep this many boards generated above the ball
    recycleBehind: 90,
    // recycle pooled entities this far below the camera
    laneWidth: 22
    // playfield horizontal span (X)
  },
  /** Object-pool capacities, pre-allocated on load to avoid GC spikes mid-run. */
  pools: {
    dots: 400,
    rails: 120,
    // walls + ramps + slingshots + gate per board (~9 each)
    bumpers: 64,
    // pop-bumper clusters (up to 3 per board)
    powerups: 24,
    particles: 256
  }
};

// src/math/Vec2.ts
var Vec2 = class _Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  static zero() {
    return new _Vec2(0, 0);
  }
  static fromAngle(angle, length = 1) {
    return new _Vec2(Math.cos(angle) * length, Math.sin(angle) * length);
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  clone() {
    return new _Vec2(this.x, this.y);
  }
  add(v) {
    return new _Vec2(this.x + v.x, this.y + v.y);
  }
  addSelf(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  addScaledSelf(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    return this;
  }
  sub(v) {
    return new _Vec2(this.x - v.x, this.y - v.y);
  }
  subSelf(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  scale(s) {
    return new _Vec2(this.x * s, this.y * s);
  }
  scaleSelf(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  /** 2D cross product (returns the scalar z-component). */
  cross(v) {
    return this.x * v.y - this.y * v.x;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  length() {
    return Math.sqrt(this.lengthSq());
  }
  normalize() {
    const len = this.length();
    return len > 1e-9 ? new _Vec2(this.x / len, this.y / len) : new _Vec2(0, 0);
  }
  normalizeSelf() {
    const len = this.length();
    if (len > 1e-9) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }
  /** Left-hand perpendicular (rotate +90°). */
  perp() {
    return new _Vec2(-this.y, this.x);
  }
  /** Rotate around the origin by `angle` radians. */
  rotate(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new _Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }
  /** Reflect this vector about a unit normal `n` with a restitution factor. */
  reflect(n, restitution = 1) {
    const d = this.dot(n) * (1 + restitution);
    return new _Vec2(this.x - d * n.x, this.y - d * n.y);
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceSqTo(v));
  }
  distanceSqTo(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }
  angle() {
    return Math.atan2(this.y, this.x);
  }
};

// src/physics/Ball.ts
var Ball = class {
  position = new Vec2();
  velocity = new Vec2();
  /** Previous fixed-step position, kept for render interpolation. */
  prevPosition = new Vec2();
  radius = Config.ball.radius;
  mass = Config.ball.mass;
  /** Highest Y ever reached — drives distance/score and one-shot checkpoints. */
  maxY = 0;
  reset(x, y) {
    this.position.set(x, y);
    this.prevPosition.set(x, y);
    this.velocity.set(0, 0);
    this.maxY = y;
  }
  /** Clamp speed so the swept solver always has a well-conditioned motion. */
  clampSpeed() {
    const speedSq = this.velocity.lengthSq();
    const max = Config.ball.maxSpeed;
    if (speedSq > max * max) {
      this.velocity.scaleSelf(max / Math.sqrt(speedSq));
    }
  }
};

// src/physics/collision.ts
function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let s = lenSq > 1e-9 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq : 0;
  s = s < 0 ? 0 : s > 1 ? 1 : s;
  return { point: new Vec2(a.x + abx * s, a.y + aby * s), s };
}
function rayCircleToi(p, d, c, r) {
  const mx = p.x - c.x;
  const my = p.y - c.y;
  const a = d.x * d.x + d.y * d.y;
  if (a < 1e-12) return -1;
  const b = 2 * (mx * d.x + my * d.y);
  const cc = mx * mx + my * my - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  const t2 = (-b - Math.sqrt(disc)) / (2 * a);
  return t2;
}
function sweepCircleSegment(p, ballR, d, a, b, segR) {
  const R = ballR + segR;
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
  let bestNormal = null;
  let bestPoint = null;
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const segLen = Math.hypot(ex, ey);
  if (segLen > 1e-6) {
    const ux = ex / segLen;
    const uy = ey / segLen;
    const nx = -uy;
    const ny = ux;
    const relx = p.x - a.x;
    const rely = p.y - a.y;
    const d0 = relx * nx + rely * ny;
    const vn = d.x * nx + d.y * ny;
    if (Math.abs(vn) > 1e-9) {
      const side = d0 >= 0 ? 1 : -1;
      const t2 = (side * R - d0) / vn;
      if (t2 >= 0 && t2 <= 1) {
        const sx = p.x + d.x * t2 - a.x;
        const sy = p.y + d.y * t2 - a.y;
        const along = sx * ux + sy * uy;
        if (along >= 0 && along <= segLen) {
          best = t2;
          bestNormal = new Vec2(side * nx, side * ny);
          bestPoint = new Vec2(a.x + ux * along, a.y + uy * along);
        }
      }
    }
  }
  for (const cap of [a, b]) {
    const t2 = rayCircleToi(p, d, cap, R);
    if (t2 >= 0 && t2 <= 1 && t2 < best) {
      const hx = p.x + d.x * t2;
      const hy = p.y + d.y * t2;
      let nx = hx - cap.x;
      let ny = hy - cap.y;
      const len = Math.hypot(nx, ny) || 1e-6;
      nx /= len;
      ny /= len;
      best = t2;
      bestNormal = new Vec2(nx, ny);
      bestPoint = new Vec2(cap.x, cap.y);
    }
  }
  if (bestNormal && bestPoint && best <= 1) {
    return { t: best, normal: bestNormal, point: bestPoint };
  }
  return null;
}
function sweepCircleCircle(p, ballR, d, c, circR) {
  const R = ballR + circR;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const startDistSq = dx * dx + dy * dy;
  if (startDistSq < R * R - 1e-4) {
    const dist = Math.sqrt(startDistSq) || 1e-6;
    const normal = new Vec2(dx / dist, dy / dist);
    return { t: 0, normal, point: new Vec2(c.x + normal.x * circR, c.y + normal.y * circR) };
  }
  const t2 = rayCircleToi(p, d, c, R);
  if (t2 < 0 || t2 > 1) return null;
  const hx = p.x + d.x * t2;
  const hy = p.y + d.y * t2;
  let nx = hx - c.x;
  let ny = hy - c.y;
  const len = Math.hypot(nx, ny) || 1e-6;
  nx /= len;
  ny /= len;
  return { t: t2, normal: new Vec2(nx, ny), point: new Vec2(c.x + nx * circR, c.y + ny * circR) };
}
function resolveBounce(velocity, normal, restitution, friction, surfaceVel = Vec2.zero()) {
  const rel = velocity.sub(surfaceVel);
  const vn = rel.dot(normal);
  if (vn >= 0) {
    return velocity.clone();
  }
  const normalImpulse = normal.scale(-(1 + restitution) * vn);
  const tangent = new Vec2(-normal.y, normal.x);
  const vt = rel.dot(tangent);
  const frictionImpulse = tangent.scale(-vt * friction);
  return rel.add(normalImpulse).add(frictionImpulse).add(surfaceVel);
}

// src/core/EventBus.ts
var EventBus = class {
  handlers = /* @__PURE__ */ new Map();
  on(event, handler) {
    let set = this.handlers.get(event);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }
  emit(event, payload) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(payload);
    }
  }
  clear() {
    this.handlers.clear();
  }
};
var bus = new EventBus();

// src/physics/PhysicsWorld.ts
var BROADPHASE_Y = 34;
var PhysicsWorld = class {
  ball = new Ball();
  flippers = [];
  /** Active static colliders. The level streamer owns the backing pool. */
  segments = /* @__PURE__ */ new Set();
  bumpers = /* @__PURE__ */ new Set();
  /** Optional time-scale (Slow Motion power-up scales the whole sim). */
  timeScale = 1;
  gravity = Config.physics.gravity;
  // Auto-nudge bookkeeping.
  stuckTimer = 0;
  stuckAnchor = new Vec2();
  addFlipper(flipper) {
    this.flippers.push(flipper);
  }
  addSegment(seg) {
    this.segments.add(seg);
  }
  removeSegment(seg) {
    this.segments.delete(seg);
  }
  clearSegments() {
    this.segments.clear();
  }
  addBumper(b) {
    this.bumpers.add(b);
  }
  removeBumper(b) {
    this.bumpers.delete(b);
  }
  step(dt) {
    const scaledDt = dt * this.timeScale;
    if (scaledDt <= 0) return;
    for (const flipper of this.flippers) flipper.step(scaledDt);
    const ball2 = this.ball;
    ball2.prevPosition.copy(ball2.position);
    ball2.velocity.y -= this.gravity * scaledDt;
    ball2.clampSpeed();
    this.integrateWithCCD(scaledDt);
    if (ball2.position.y > ball2.maxY) ball2.maxY = ball2.position.y;
    this.updateNudge(scaledDt);
  }
  /**
   * Move the ball by velocity·dt, resolving the earliest contact and continuing
   * with the remaining time. Capped iterations keep a corner pile-up bounded.
   */
  integrateWithCCD(dt) {
    const ball2 = this.ball;
    let remaining = dt;
    for (let iter = 0; iter < 6 && remaining > 1e-6; iter++) {
      const motion = ball2.velocity.scale(remaining);
      const hit = this.firstHit(ball2.position, ball2.radius, motion);
      if (!hit) {
        ball2.position.addSelf(motion);
        break;
      }
      const travel = Math.max(0, hit.t - 1e-4);
      ball2.position.addScaledSelf(motion, travel);
      ball2.velocity.copy(
        resolveBounce(ball2.velocity, hit.normal, hit.restitution, hit.friction, hit.surfaceVel)
      );
      if (hit.tipBoost > 0) {
        ball2.velocity.addScaledSelf(hit.normal, hit.tipBoost);
      }
      if (hit.kick > 0) {
        ball2.velocity.addScaledSelf(hit.normal, hit.kick);
      }
      if (hit.kickUp > 0 && ball2.velocity.y > -1) {
        ball2.velocity.y += hit.kickUp;
      }
      ball2.clampSpeed();
      bus.emit("ball:collide", {
        speed: ball2.velocity.length(),
        nx: hit.normal.x,
        ny: hit.normal.y,
        x: hit.point.x,
        y: hit.point.y
      });
      remaining *= 1 - Math.max(travel, 0);
      ball2.position.addScaledSelf(hit.normal, 1e-3);
    }
  }
  /** Find the earliest contact among segments and flippers for this motion. */
  firstHit(p, r, motion) {
    let best = null;
    const by = p.y;
    for (const seg of this.segments) {
      if (!seg.active) continue;
      if (seg.oneWayY > 0 && motion.y > -1e-4) continue;
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
          kickUp: seg.kickUp
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
          kickUp: 0
        };
      }
    }
    for (const flipper of this.flippers) {
      if (!flipper.active) continue;
      const hit = sweepCircleSegment(p, r, motion, flipper.pivot, flipper.tip, flipper.radius);
      if (hit && (!best || hit.t < best.t)) {
        const surfaceVel = flipper.surfaceVelocityAt(hit.point);
        const swinging = flipper.pressed && Math.abs(flipper.angularVelocity) > 0.5;
        best = {
          ...hit,
          restitution: flipper.restitution,
          friction: flipper.friction,
          surfaceVel,
          tipBoost: swinging ? Config.flipper.tipBoost : 0,
          kick: 0,
          kickUp: 0
        };
      }
    }
    return best;
  }
  /**
   * Auto-nudge: if the ball barely moves for `stuckSeconds`, apply a small
   * random impulse to dislodge it (blueprint §Dynamic Obstacles).
   */
  updateNudge(dt) {
    const ball2 = this.ball;
    const moved = ball2.position.distanceTo(this.stuckAnchor);
    if (moved > Config.nudge.positionEpsilon) {
      this.stuckAnchor.copy(ball2.position);
      this.stuckTimer = 0;
      return;
    }
    this.stuckTimer += dt;
    if (this.stuckTimer >= Config.nudge.stuckSeconds) {
      const seed = (ball2.position.x * 12.9898 + ball2.position.y * 78.233) % (Math.PI * 2);
      const dir = Vec2.fromAngle(seed, Config.nudge.impulse);
      dir.y = Math.abs(dir.y);
      ball2.velocity.addSelf(dir);
      this.stuckTimer = 0;
      this.stuckAnchor.copy(ball2.position);
      bus.emit("ball:nudge", void 0);
    }
  }
  resetNudge() {
    this.stuckTimer = 0;
    this.stuckAnchor.copy(this.ball.position);
  }
};

// src/math/MathUtils.ts
var TAU = Math.PI * 2;
function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}
function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t2 = Math.imul(a ^ a >>> 15, 1 | a);
    t2 = t2 + Math.imul(t2 ^ t2 >>> 7, 61 | t2) ^ t2;
    return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296;
  };
}
function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

// src/physics/Flipper.ts
var Flipper = class {
  pivot = new Vec2();
  side;
  length = Config.flipper.length;
  radius = Config.flipper.width * 0.5;
  restitution = Config.flipper.restitution;
  friction = Config.flipper.friction;
  /** Resting and actuated angles (radians, in world space for this side). */
  restAngle;
  upAngle;
  /** Current angle and the previous-step angle (for angular velocity). */
  angle;
  prevAngle;
  angularVelocity = 0;
  pressed = false;
  /** When false the flipper is off-screen/pooled and skipped by the solver. */
  active = false;
  /** Live tip position, recomputed each step. */
  tip = new Vec2();
  constructor(side, pivotX, pivotY) {
    this.side = side;
    this.pivot.set(pivotX, pivotY);
    const rest = Config.flipper.restAngleDeg * Math.PI / 180;
    const up = Config.flipper.upAngleDeg * Math.PI / 180;
    if (side === "left") {
      this.restAngle = rest;
      this.upAngle = up;
    } else {
      this.restAngle = Math.PI - rest;
      this.upAngle = Math.PI - up;
    }
    this.angle = this.restAngle;
    this.prevAngle = this.restAngle;
    this.updateTip();
  }
  setPivot(x, y) {
    this.pivot.set(x, y);
    this.updateTip();
  }
  press(down) {
    this.pressed = down;
  }
  /** Advance the flipper toward its target angle at the configured speed. */
  step(dt) {
    if (!this.active) return;
    this.prevAngle = this.angle;
    const target = this.pressed ? this.upAngle : this.restAngle;
    const maxDelta = Config.flipper.angularSpeed * dt;
    this.angle = approach(this.angle, target, maxDelta);
    this.angularVelocity = (this.angle - this.prevAngle) / dt;
    this.updateTip();
  }
  updateTip() {
    this.tip.set(
      this.pivot.x + Math.cos(this.angle) * this.length,
      this.pivot.y + Math.sin(this.angle) * this.length
    );
  }
  /** Velocity of the flipper surface at world point `q` (ω × r). */
  surfaceVelocityAt(q) {
    const rx = q.x - this.pivot.x;
    const ry = q.y - this.pivot.y;
    return new Vec2(-ry * this.angularVelocity, rx * this.angularVelocity);
  }
};

// src/physics/Segment.ts
var Segment = class {
  a = new Vec2();
  b = new Vec2();
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
  kind = "wall";
  set(ax, ay, bx, by) {
    this.a.set(ax, ay);
    this.b.set(bx, by);
    return this;
  }
  reset() {
    this.active = true;
  }
  recycle() {
    this.active = false;
    this.kick = 0;
    this.kickUp = 0;
    this.oneWayY = 0;
  }
};

// src/physics/CircleCollider.ts
var CircleCollider = class {
  center = new Vec2();
  radius = 1.4;
  restitution = 1.18;
  friction = 0.02;
  active = false;
  set(x, y, radius) {
    this.center.set(x, y);
    this.radius = radius;
    return this;
  }
  reset() {
    this.active = true;
  }
  recycle() {
    this.active = false;
  }
};

// src/level/railProps.ts
function railPhysics(kind) {
  switch (kind) {
    case "wall":
    case "rail":
      return { restitution: 0.62, friction: 0.02, kick: 0, kickUp: 0, oneWayY: 0, collisionRadius: 0.5 };
    case "ramp":
      return { restitution: 0.55, friction: 8e-3, kick: 0, kickUp: 16, oneWayY: 0, collisionRadius: 0.42 };
    case "sling":
      return { restitution: 0.95, friction: 0.04, kick: 14, kickUp: 0, oneWayY: 0, collisionRadius: 0.55 };
    case "gate":
      return { restitution: 0.1, friction: 0.5, kick: 0, kickUp: 0, oneWayY: 1, collisionRadius: 0.45 };
  }
}

// src/config/Biomes.ts
var BIOMES = [
  {
    id: "origin",
    name: "Origin Canyon",
    rank: "Rookie",
    minDistance: 0,
    maxDistance: 999,
    accent: 1368319,
    accentB: 2989055,
    background: 327951,
    difficulty: { tightness: 0, powerupChance: 0.12, lateralVoids: false, ballReleasers: false }
  },
  {
    id: "circuit",
    name: "Circuit Canyon",
    rank: "Omega Rider",
    minDistance: 1e3,
    maxDistance: 1999,
    accent: 3014613,
    accentB: 1368319,
    background: 264722,
    difficulty: { tightness: 0.15, powerupChance: 0.18, lateralVoids: false, ballReleasers: false }
  },
  {
    id: "electric",
    name: "Electric Canyon",
    rank: "Electric Dreamer",
    minDistance: 2e3,
    maxDistance: 2999,
    accent: 8191805,
    accentB: 15400749,
    background: 396294,
    difficulty: { tightness: 0.3, powerupChance: 0.2, lateralVoids: false, ballReleasers: false }
  },
  {
    id: "commander",
    name: "Commander Canyon",
    rank: "Laser Cruiser",
    minDistance: 3e3,
    maxDistance: 3999,
    accent: 16747053,
    accentB: 16765501,
    background: 1050116,
    difficulty: { tightness: 0.4, powerupChance: 0.22, lateralVoids: true, ballReleasers: false }
  },
  {
    id: "grid",
    name: "Grid Canyon",
    rank: "Grid Commander",
    minDistance: 4e3,
    maxDistance: 4999,
    accent: 10181887,
    accentB: 6064895,
    background: 591386,
    difficulty: { tightness: 0.5, powerupChance: 0.24, lateralVoids: true, ballReleasers: false }
  },
  {
    id: "voidspace",
    name: "Void Canyon",
    rank: "Cyber Ninja",
    minDistance: 5e3,
    maxDistance: 5999,
    accent: 16723349,
    accentB: 16735432,
    background: 1180442,
    difficulty: { tightness: 0.6, powerupChance: 0.26, lateralVoids: true, ballReleasers: false }
  },
  {
    id: "neon-isles",
    name: "Neon Isles",
    rank: "Neon Defender",
    minDistance: 6e3,
    maxDistance: 6999,
    accent: 16727406,
    accentB: 16755245,
    background: 1311754,
    difficulty: { tightness: 0.68, powerupChance: 0.26, lateralVoids: true, ballReleasers: true }
  },
  {
    id: "midnight",
    name: "Midnight Mountains",
    rank: "Midnight Legend",
    minDistance: 7e3,
    maxDistance: 7999,
    accent: 4026111,
    accentB: 10181887,
    background: 131850,
    difficulty: { tightness: 0.78, powerupChance: 0.22, lateralVoids: true, ballReleasers: true }
  }
];
var OVERTIME_BIOME = {
  id: "overtime",
  name: "Overtime",
  rank: "Overtime",
  minDistance: 8e3,
  maxDistance: Number.POSITIVE_INFINITY,
  accent: 6978186,
  // desaturated — signals the absence of time-restoring elements
  accentB: 4872810,
  background: 263690,
  difficulty: { tightness: 0.7, powerupChance: 0, lateralVoids: true, ballReleasers: true }
};
function isOvertime(distance) {
  return distance >= OVERTIME_BIOME.minDistance;
}
function biomeForDistance(distance) {
  if (isOvertime(distance)) {
    return OVERTIME_BIOME;
  }
  for (const biome of BIOMES) {
    if (distance >= biome.minDistance && distance <= biome.maxDistance) {
      return biome;
    }
  }
  return BIOMES[BIOMES.length - 1];
}

// src/level/ChunkGenerator.ts
var H = Config.level.chunkHeight;
var HALF = Config.level.laneWidth * 0.5;
var SEED = 2654435761;
var NECK_X = 1.9;
var TOP = H - 2;
function centreX(y) {
  return Math.sin(y * 8e-3) * 3;
}
function pinch(y) {
  return Math.sin(y * 0.018 + 1.3) * 0.9;
}
function edgeX(y, sign) {
  return centreX(y) + sign * (HALF - 0.4 - pinch(y));
}
function P(c, lx, ly) {
  const y = c.baseY + ly;
  return { x: centreX(y) + lx, y };
}
function dotsAlong(points, spacing, out, inset = 1.15) {
  let next = spacing * 0.5;
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    while (next <= acc + len) {
      const t2 = (next - acc) / len;
      const x = a.x + (b.x - a.x) * t2;
      const y = a.y + (b.y - a.y) * t2;
      const toward = Math.sign(centreX(y) - x) || 1;
      out.push({ x: x + toward * inset, y });
      next += spacing;
    }
    acc += len;
  }
}
function twinRamps(c) {
  for (const s of [-1, 1]) {
    const ramp = [
      P(c, s * 8.8, 13),
      P(c, s * 9.2, 19),
      P(c, s * 7.8, 26),
      P(c, s * 4.6, 33),
      P(c, s * NECK_X, TOP)
    ];
    c.rails.push({ kind: "ramp", points: ramp });
    if (!c.overtime) dotsAlong(ramp, 3.4, c.dots);
  }
  c.bumpers.push(P(c, c.ps * 3.4, 22));
  if (!c.overtime) {
    c.dots.push(P(c, 0, 15.5), P(c, -c.ps * 2.2, 27), P(c, 0, 34.5));
  }
}
function orbit(c) {
  const s = c.ps;
  const main = [
    P(c, s * 8.8, 11),
    P(c, s * 9.2, 17),
    P(c, s * 8.9, 25),
    P(c, s * 5.6, 32.5),
    P(c, s * NECK_X, TOP)
  ];
  c.rails.push({ kind: "ramp", points: main });
  if (!c.overtime) dotsAlong(main, 3, c.dots);
  const deflector = [
    P(c, -s * 8.8, 16),
    P(c, -s * 7, 27),
    P(c, -s * NECK_X, TOP)
  ];
  c.rails.push({ kind: "ramp", points: deflector });
  c.bumpers.push(P(c, -s * 5.2, 14), P(c, -s * 3.2, 21));
  if (!c.overtime) c.dots.push(P(c, 0, 30), P(c, s * 0.9, 35));
}
function island(c) {
  const iy = 24;
  const diamond = [
    P(c, 0, iy - 5.2),
    P(c, 4.2, iy),
    P(c, 0, iy + 5.2),
    P(c, -4.2, iy),
    P(c, 0, iy - 5.2)
  ];
  c.rails.push({ kind: "wall", points: diamond });
  for (const s of [-1, 1]) {
    const lane = [
      P(c, s * 8.8, 13),
      P(c, s * 8.2, 22),
      P(c, s * 6.6, 30),
      P(c, s * NECK_X, TOP)
    ];
    c.rails.push({ kind: "ramp", points: lane });
    if (!c.overtime) dotsAlong(lane, 3.4, c.dots);
  }
  if (!c.overtime) c.dots.push(P(c, 0, 33.5));
}
function nest(c) {
  c.bumpers.push(P(c, -4.6, 19), P(c, 4.6, 19), P(c, 0, 26));
  for (const s of [-1, 1]) {
    const guide = [
      P(c, s * 8.8, 13),
      P(c, s * 8.4, 23),
      P(c, s * 5.2, 32),
      P(c, s * NECK_X, TOP)
    ];
    c.rails.push({ kind: "ramp", points: guide });
    if (!c.overtime) dotsAlong(guide, 4.2, c.dots);
  }
  if (!c.overtime) {
    c.dots.push(P(c, -2.3, 22.5), P(c, 2.3, 22.5), P(c, 0, 31.5));
  }
}
var ARCHETYPES = [twinRamps, orbit, island, nest];
function generateChunk(index) {
  const baseY = index * H;
  const topY = baseY + H;
  const biome = biomeForDistance(baseY);
  const overtime = isOvertime(baseY);
  const rng = createRng(SEED ^ index * 2246822507);
  const rails = [];
  const bumpers = [];
  const dots = [];
  const powerups = [];
  const flippers = [];
  const ps = index % 2 === 0 ? 1 : -1;
  const c = { baseY, rng, ps, overtime, rails, bumpers, dots, powerups };
  const samples = 8;
  const leftPts = [];
  const rightPts = [];
  for (let s = 0; s <= samples; s++) {
    const y = baseY + s / samples * H;
    leftPts.push({ x: edgeX(y, -1), y });
    rightPts.push({ x: edgeX(y, 1), y });
  }
  rails.push({ points: leftPts, kind: "wall" });
  rails.push({ points: rightPts, kind: "wall" });
  const gateY = baseY + 0.5;
  rails.push({
    kind: "gate",
    points: [
      { x: edgeX(gateY, -1), y: gateY },
      { x: edgeX(gateY, 1), y: gateY }
    ]
  });
  flippers.push({ centerX: centreX(baseY + 5), y: baseY + 5, gap: HALF * 1.05 });
  rails.push({ kind: "sling", points: [P(c, -8.8, 5.5), P(c, -6.2, 10.5)] });
  rails.push({ kind: "sling", points: [P(c, 8.8, 5.5), P(c, 6.2, 10.5)] });
  const archetype = index === 0 ? twinRamps : ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
  archetype(c);
  if (!overtime && rng() < biome.difficulty.powerupChance) {
    const ly = randRange(rng, H * 0.55, H * 0.78);
    powerups.push(P(c, -ps * (HALF - 3.4), ly));
  }
  let checkpointY = null;
  const boundary = Math.ceil(baseY / 1e3) * 1e3;
  if (boundary >= baseY && boundary < topY && boundary > 0) checkpointY = boundary;
  return { index, baseY, topY, biome, rails, bumpers, dots, powerups, flippers, checkpointY };
}

// scripts/sim.ts
var H2 = Config.level.chunkHeight;
var HALF2 = Config.level.laneWidth * 0.5;
var BUMPER_RADIUS = 1.5;
var DT = Config.physics.fixedDt;
var TIME_BUDGET = 150;
var TARGET_Y = 80;
var world = new PhysicsWorld();
var live = /* @__PURE__ */ new Map();
var archetypesSeen = /* @__PURE__ */ new Set();
var budgetFailures = [];
function classifyArchetype(spec) {
  const mid = spec.rails.slice(5);
  const ramps = mid.filter((r) => r.kind === "ramp").length;
  const walls = mid.filter((r) => r.kind === "wall").length;
  if (walls === 1) return "island";
  if (spec.bumpers.length === 3) return "nest";
  if (ramps === 2 && spec.bumpers.length === 1) return "twinRamps";
  if (ramps === 2 && spec.bumpers.length === 2) return "orbit";
  return `unknown(ramps=${ramps},walls=${walls},bumpers=${spec.bumpers.length})`;
}
function instantiate(index) {
  if (live.has(index) || index < 0) return;
  const spec = generateChunk(index);
  const chunk = { spec, segments: [], bumpers: [], flippers: [] };
  for (const r of spec.rails) {
    const phys = railPhysics(r.kind);
    for (let i = 0; i < r.points.length - 1; i++) {
      const seg = new Segment();
      seg.set(r.points[i].x, r.points[i].y, r.points[i + 1].x, r.points[i + 1].y);
      seg.radius = phys.collisionRadius;
      seg.restitution = phys.restitution;
      seg.friction = phys.friction;
      seg.kick = phys.kick;
      seg.kickUp = phys.kickUp;
      seg.oneWayY = phys.oneWayY;
      seg.kind = r.kind === "rail" ? "wall" : r.kind;
      seg.active = true;
      world.addSegment(seg);
      chunk.segments.push(seg);
    }
  }
  for (const b of spec.bumpers) {
    const col = new CircleCollider().set(b.x, b.y, BUMPER_RADIUS);
    col.active = true;
    world.addBumper(col);
    chunk.bumpers.push(col);
  }
  for (const f of spec.flippers) {
    const left = new Flipper("left", f.centerX - f.gap * 0.5, f.y);
    const right = new Flipper("right", f.centerX + f.gap * 0.5, f.y);
    left.active = true;
    right.active = true;
    world.addFlipper(left);
    world.addFlipper(right);
    chunk.flippers.push(left, right);
  }
  const LIVE_BOARDS = 5;
  if (spec.rails.length * LIVE_BOARDS > Config.pools.rails)
    budgetFailures.push(`board ${index}: ${spec.rails.length} rails \xD7 ${LIVE_BOARDS} > pool ${Config.pools.rails}`);
  if (spec.dots.length * LIVE_BOARDS > Config.pools.dots)
    budgetFailures.push(`board ${index}: ${spec.dots.length} dots \xD7 ${LIVE_BOARDS} > pool ${Config.pools.dots}`);
  if (spec.bumpers.length * LIVE_BOARDS > Config.pools.bumpers)
    budgetFailures.push(`board ${index}: ${spec.bumpers.length} bumpers \xD7 ${LIVE_BOARDS} > pool ${Config.pools.bumpers}`);
  archetypesSeen.add(classifyArchetype(spec));
  live.set(index, chunk);
}
function recycle(index) {
  const chunk = live.get(index);
  if (!chunk) return;
  for (const s of chunk.segments) world.removeSegment(s);
  for (const b of chunk.bumpers) world.removeBumper(b);
  for (const f of chunk.flippers) f.active = false;
  live.delete(index);
}
function stream(ballY) {
  const current = Math.floor(ballY / H2);
  for (let i = Math.max(0, current - 1); i <= current + Config.level.spawnAheadChunks; i++) {
    instantiate(i);
  }
  for (const idx of [...live.keys()]) {
    if (idx < current - 1) recycle(idx);
  }
}
var SPAWN = { x: 1.5, y: 8 };
var ball = world.ball;
ball.reset(SPAWN.x, SPAWN.y);
stream(SPAWN.y);
var launchArmed = true;
var captureTimer = 0;
var pressTimer = 0;
var pressedSide = null;
var flipCooldown = 0;
var launches = 0;
var flips = 0;
var containViolation = null;
function nearestFlipperPair() {
  const idx = Math.floor(ball.position.y / H2);
  return live.get(idx)?.flippers ?? [];
}
function setFlippers(side) {
  for (const c of live.values()) {
    for (const f of c.flippers) {
      f.press(f.side === side);
    }
  }
}
function launch() {
  const side = ball.position.x < centreX(ball.position.y) ? "right" : "left";
  const sideX = side === "left" ? Config.launch.aimX : -Config.launch.aimX;
  ball.velocity.set(sideX, Config.launch.plungeSpeed);
  ball.clampSpeed();
  world.resetNudge();
  launchArmed = false;
  captureTimer = 0;
  launches++;
}
var t = 0;
var maxY = SPAWN.y;
var archeLog = [];
while (t < TIME_BUDGET) {
  const localY = ball.position.y - Math.floor(ball.position.y / H2) * H2;
  const vy = ball.velocity.y;
  if (launchArmed) {
    launch();
  }
  if (!launchArmed) {
    if (ball.velocity.length() < Config.launch.captureSpeed && localY < Config.launch.captureMaxLocalY) {
      captureTimer += DT;
      if (captureTimer >= Config.launch.captureDelay) launchArmed = true;
    } else {
      captureTimer = 0;
    }
  }
  flipCooldown -= DT;
  if (pressedSide) {
    pressTimer -= DT;
    if (pressTimer <= 0) {
      pressedSide = null;
      setFlippers(null);
      flipCooldown = 0.25;
    }
  } else if (flipCooldown <= 0 && vy < -2 && localY < 11 && localY > 3.5) {
    const pair = nearestFlipperPair();
    if (pair.length) {
      const cx = (pair[0].pivot.x + pair[1].pivot.x) * 0.5;
      pressedSide = ball.position.x < cx ? "left" : "right";
      setFlippers(pressedSide);
      pressTimer = 0.3;
      flips++;
    }
  }
  world.step(DT);
  t += DT;
  maxY = Math.max(maxY, ball.position.y);
  stream(ball.position.y);
  const dx = Math.abs(ball.position.x - centreX(ball.position.y));
  if (dx > HALF2 + 1.5 || ball.position.y < -5) {
    containViolation = `t=${t.toFixed(1)}s pos=(${ball.position.x.toFixed(2)}, ${ball.position.y.toFixed(2)}) dx=${dx.toFixed(2)}`;
    break;
  }
  if (maxY >= TARGET_Y && archetypesSeen.size >= 4) break;
}
for (let i = 0; i < 24; i++) {
  const spec = generateChunk(i);
  const a = classifyArchetype(spec);
  archetypesSeen.add(a);
  if (i < 8) archeLog.push(`board ${i}: ${a} (rails=${spec.rails.length}, dots=${spec.dots.length}, bumpers=${spec.bumpers.length})`);
}
var climbed = maxY >= TARGET_Y;
var unknowns = [...archetypesSeen].filter((a) => a.startsWith("unknown"));
var variety = ["twinRamps", "orbit", "island", "nest"].every((a) => archetypesSeen.has(a));
console.log("--- PinIn headless sim ---");
console.log(`sim time: ${t.toFixed(1)}s  launches: ${launches}  flips: ${flips}`);
console.log(`maxY: ${maxY.toFixed(1)} (target ${TARGET_Y})  \u2192 ${climbed ? "PASS" : "FAIL"}`);
console.log(`containment: ${containViolation ? `FAIL ${containViolation}` : "PASS"}`);
console.log(`archetypes: ${[...archetypesSeen].join(", ")}  \u2192 ${variety && unknowns.length === 0 ? "PASS" : "FAIL"}`);
console.log(`pool budgets: ${budgetFailures.length === 0 ? "PASS" : "FAIL\n  " + budgetFailures.join("\n  ")}`);
for (const line of archeLog) console.log("  " + line);
var ok = climbed && !containViolation && variety && unknowns.length === 0 && budgetFailures.length === 0;
process.exit(ok ? 0 : 1);
