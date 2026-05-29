/**
 * Power-up contracts (blueprint §Power-Up Mechanics & Global State Overrides).
 *
 * A power-up is a pure description plus two hooks that mutate global game state
 * through the {@link PowerUpRuntime}. Keeping defs side-effect-light (they only
 * flip flags on the runtime) makes the manager the single source of truth for
 * every override — time scale, dot value, input mode, timer gating.
 */

export type DurationKind = 'time' | 'flips' | 'instant';

export interface PowerUpDef {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly duration: { readonly kind: DurationKind; readonly amount: number };
  /** Apply the override. */
  onActivate(rt: PowerUpRuntime): void;
  /** Undo the override when the duration elapses. */
  onExpire(rt: PowerUpRuntime): void;
}

/** The surface power-ups manipulate; implemented by the PowerUpManager. */
export interface PowerUpRuntime {
  /** Global simulation time-scale (Slow Motion). Drives both physics & timer. */
  physicsTimeScale: number;
  /** Multiplier applied to each Extra Time Dot (Time Doubler → 2). */
  dotMultiplier: number;
  /** Master timer frozen entirely (Time Freeze, gated by flip count). */
  timerFrozen: boolean;
  /** Remaining flipper actuations before Time Freeze lifts. */
  freezeFlips: number;
  /** Timer only ticks while the ball is moving (Motion Link). */
  motionLink: boolean;
  /** Swipe-to-impulse control replaces flippers (Push). */
  pushMode: boolean;
  /** Teleport the ball forward by `dy` world units (Warp Drive). */
  requestWarp(dy: number): void;
  /** Activate another power-up by id (used by Random). */
  activate(id: string): void;
}
