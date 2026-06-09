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
    restitution: 0.55, // walls/ramps; flipper has its own (below)
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
    length: 3.9, // short side-mounted bats keep the centre channel passable
    // the tips leave an open central gap instead of sealing the channel
    width: 0.72,
    restitution: 0.9,
    friction: 0.9,
    restAngleDeg: -24, // resting (down) angle relative to mount, for the LEFT flipper
    upAngleDeg: 48, // actuated (up) angle relative to mount
    angularSpeed: 46, // rad/s — near-instant snap (low coil ramp-up)
    tipBoost: 34, // extra impulse imparted to the ball at the flipper tip
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
   * pinout.md). Gameplay is 2D on the X/Y plane; rendering tilts that plane back
   * so the canyon recedes into the distance as you climb. The camera sits above
   * the surface (along its normal) and behind the ball (down the incline),
   * looking up-canyon — the classic PinOut 3/4 ascending view.
   */
  camera: {
    followLambda: 4.5, // exponential damping rate for the Y follow
    tilt: 0.66, // radians the playfield reclines away from facing the camera
    height: 12, // camera offset above the playfield surface (along its normal)
    back: 17, // camera offset behind the ball, down the incline
    lookAhead: 24, // look target distance up the incline from the ball
    fov: 64,
  },

  /**
   * Selective-bloom configuration for the neon synthwave look (blueprint §Rendering).
   *
   * The bloom pass runs on the LINEAR HDR render (before the ACES output
   * tone-map), so the threshold is compared against raw emissive luminance.
   * Neon materials emit ~1.2–1.6, walls ~0.25 — a threshold of 0.9 lets only the
   * bright cores blossom while the dark canyon stays crisp. A small radius keeps
   * the glow tight instead of smearing the whole frame to white.
   */
  bloom: {
    threshold: 0.9,
    strength: 0.55,
    radius: 0.32,
    exposure: 1.0,
  },

  level: {
    chunkHeight: 54, // world-units per chunk (also the spacing between flipper pairs)
    spawnAheadChunks: 3, // keep this many chunks generated above the ball
    recycleBehind: 75, // recycle pooled entities this far below the camera
    laneWidth: 24, // playfield horizontal span (X)
  },

  /** Object-pool capacities, pre-allocated on load to avoid GC spikes mid-run. */
  pools: {
    dots: 400,
    rails: 128, // curved tube rails (ramps, return lanes, side walls)
    bumpers: 72, // pop bumpers
    powerups: 24,
    particles: 256,
  },
} as const;

export type GameConfig = typeof Config;
