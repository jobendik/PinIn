/**
 * Per-rail-kind physics & visual properties.
 *
 * Kept deliberately Three-free so the *gameplay* meaning of every table element
 * lives in one place and can be unit-tested headlessly. {@link RailEntity}
 * reads the visual half; {@link PhysicsWorld} consumes the physics half via the
 * fields these set on each {@link Segment}.
 *
 * Pinball vocabulary, mapped to collider tuning:
 *  - wall / rail : the canyon boundary. Lively restitution so the ball
 *                  *ricochets* like a real table instead of dying on contact.
 *  - ramp        : a guide the ball rides up; low friction so momentum carries,
 *                  moderate restitution so it slides rather than rattles.
 *  - sling       : a slingshot kicker. High restitution PLUS a `kick` impulse
 *                  along the contact normal, snapping the ball back into play.
 *  - gate        : a one-way energy gate (a ratchet). Passable travelling up the
 *                  canyon, solid travelling back down, so a missed shot drops you
 *                  onto your flippers but never below the board you fought into.
 */
export type RailKind = 'rail' | 'ramp' | 'wall' | 'sling' | 'gate';

export interface RailPoint {
  x: number;
  y: number;
}

export interface RailPhysics {
  restitution: number;
  friction: number;
  /** Extra impulse along the contact normal (slingshot snap). 0 = none. */
  kick: number;
  /**
   * Vertical lift applied when a *climbing* ball touches the surface, in u/s.
   * Simulates a powered habitrail/ramp that carries the ball up the canyon —
   * the ONLY way a guide surface can add height in this 2D model (a normal-
   * direction kick on a near-vertical funnel wall points sideways, not up).
   * Only assists an already-rising ball, so it never flings a falling one.
   */
  kickUp: number;
  /** 0 = solid; +1 = pass when travelling up-canyon, block when falling back. */
  oneWayY: number;
  /** Capsule radius of the colliders generated along the polyline. */
  collisionRadius: number;
}

export interface RailVisual {
  tubeRadius: number;
  /** Emissive intensity passed to the neon material. */
  intensity: number;
}

export function railPhysics(kind: RailKind): RailPhysics {
  switch (kind) {
    case 'wall':
    case 'rail':
      // Bouncy boundary — the ball pings off the canyon walls and keeps energy.
      return { restitution: 0.62, friction: 0.02, kick: 0, kickUp: 0, oneWayY: 0, collisionRadius: 0.5 };
    case 'ramp':
      // Guide surface that LIFTS: slick, mildly bouncy, and gives a rising ball a
      // gentle vertical boost on contact so a weak shot hugging a lane is
      // carried up to the gate. A clean centre shot never touches it.
      return { restitution: 0.55, friction: 0.008, kick: 0, kickUp: 16, oneWayY: 0, collisionRadius: 0.42 };
    case 'sling':
      // Slingshot: snappy bounce + a normal-direction kick back toward play.
      return { restitution: 0.95, friction: 0.04, kick: 14, kickUp: 0, oneWayY: 0, collisionRadius: 0.55 };
    case 'gate':
      // One-way ratchet floor: deadens a falling ball, lets a climbing one pass.
      return { restitution: 0.1, friction: 0.5, kick: 0, kickUp: 0, oneWayY: 1, collisionRadius: 0.45 };
  }
}

export function railVisual(kind: RailKind): RailVisual {
  switch (kind) {
    case 'wall':
    case 'rail':
      return { tubeRadius: 0.5, intensity: 1.6 };
    case 'ramp':
      return { tubeRadius: 0.42, intensity: 1.9 };
    case 'sling':
      return { tubeRadius: 0.62, intensity: 2.3 };
    case 'gate':
      return { tubeRadius: 0.28, intensity: 1.0 };
  }
}
