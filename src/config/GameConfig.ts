/**
 * Central tuning table for PinIn.
 *
 * Every magic number that defines "game feel" lives here so that the simulation
 * stays declarative and the values map directly back to the design blueprint.
 * World units are abstract; 1 unit ≈ a few centimetres of table.
 */
export const Config = {
  /** Fixed-timestep simulation cadence (see blueprint §HTML5 Optimization). */
  physics: {
    fixedDt: 1 / 120, // 120 Hz solver for crisp, deterministic ballistics
    maxSubSteps: 8, // cap catch-up iterations to avoid the "spiral of death"
    gravity: 28, // world units / s^2, pulling toward -Y (down the canyon)
    velocityIterations: 12, // blueprint recommends 10–15
    positionIterations: 4,
    ccdMinTravel: 0.35, // swept collision kicks in when travel exceeds ball radius * this
  },

  ball: {
    radius: 0.9,
    mass: 1,
    restitution: 0.55, // walls/ramps have their own per-kind values (railProps)
    friction: 0.04, // low rolling friction so momentum carries up ramps
    maxSpeed: 108, // hard clamp to keep CCD reliable (swept, so this is safe)
    trailLength: 28,
  },

  /**
   * Flipper kinematics. The blueprint calls for ~2000–3300 torque, near-zero
   * coil ramp-up, restitution ≈ 0.88, high friction ≈ 0.9 for cradling, and an
   * effectively infinite flipper mass so the ball never deflects the stroke.
   */
  flipper: {
    length: 4.8, // ~1/4 of the lane width, like a real table — short enough that
    // the tips leave an open central drain instead of sealing the channel
    width: 1.0,
    restitution: 0.9,
    friction: 0.9,
    restAngleDeg: -32, // resting (down) angle relative to mount, for the LEFT flipper
    upAngleDeg: 38, // actuated (up) angle relative to mount
    angularSpeed: 24, // rad/s — snappy but with a catchable upswing window (~50ms)
    tipBoost: 30, // extra impulse a flipper swinging into the ball imparts — authoritative shots
  },

  /**
   * The launcher is now a pinball PLUNGER, not a free elevator. It only re-serves
   * a ball that has drained to the bottom of a board: a firm-but-finite kick that
   * puts the ball back into play among the bumpers. Climbing a board to its gate
   * is the flippers' job — a plunge alone never clears one. (See Game.ts.)
   */
  launch: {
    plungeSpeed: 36, // u/s re-serve kick — reaches ~half a board, never clears one
    aimX: 9, // lateral component, biased toward the side opposite the tap
    captureSpeed: 7, // u/s — below this the ball counts as "settled"
    captureDelay: 0.3, // s of settling before the plunger re-arms
  },

  /** The temporal economy — time is the only currency (blueprint §Temporal Economy). */
  time: {
    start: 60, // seconds on the master clock at run start
    dotBonus: 1, // +1s per Extra Time Dot
    checkpointBonus: 25, // +25s per checkpoint crossing
    dangerThreshold: 8, // HUD turns red / pulses below this
    overtimeDistance: 8000, // dots & power-ups purge beyond this (Overtime)
  },

  /** Auto-nudge: dislodge a stuck ball after this many seconds of near-zero motion. */
  nudge: {
    stuckSeconds: 3.0,
    positionEpsilon: 0.6, // movement under this (per window) counts as "stuck"
    impulse: 14,
  },

  /**
   * Forced-perspective camera up an INCLINED playfield (blueprint §Rendering /
   * pinout.md).
   */
  camera: {
    followLambda: 4.5,
    tilt: 0.66,
    height: 12,
    back: 17,
    lookAhead: 24,
    fov: 64,
  },

  /** Selective-bloom configuration for the neon synthwave look. */
  bloom: {
    threshold: 0.9,
    strength: 0.55,
    radius: 0.32,
    exposure: 1.0,
  },

  level: {
    chunkHeight: 40, // world-units per board: short enough that a clean flip can clear it
    spawnAheadChunks: 3, // keep this many boards generated above the ball
    recycleBehind: 90, // recycle pooled entities this far below the camera
    laneWidth: 22, // playfield horizontal span (X)
  },

  /** Object-pool capacities, pre-allocated on load to avoid GC spikes mid-run. */
  pools: {
    dots: 400,
    rails: 120, // walls + ramps + slingshots + gate per board (~7 each)
    bumpers: 64, // pop-bumper clusters (3 per board)
    powerups: 24,
    particles: 256,
  },
} as const;

export type GameConfig = typeof Config;
