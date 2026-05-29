/**
 * Mini-game ("video mode") framework (blueprint §Embedded Video Mode Subroutines).
 *
 * When a mini-game ramp is hit, the main 3D sim and the master clock suspend and
 * a self-contained subroutine takes over a viewport with its own control scheme,
 * render context, and loop. Every point scored converts 1:1 to seconds credited
 * to the master timer on exit.
 *
 * This module defines the contract and a registry. The four canonical modes —
 * Lazer Racer, Space Rocks, Ascender, and the Commuter World easter egg — are
 * registered here as scaffolding; each can be fleshed out behind this interface
 * without touching the core game loop. `MiniGameHost` shows how the Game would
 * suspend itself, run a mode to completion, and bank the score.
 */
export interface MiniGameResult {
  /** Raw points scored; the host converts these to master-timer seconds. */
  points: number;
}

export interface MiniGame {
  readonly id: string;
  readonly name: string;
  /** Seconds credited per point on exit (Commuter World pays 5×). */
  readonly secondsPerPoint: number;
  /** Mount into the given container and run; resolves with the score. */
  run(container: HTMLElement): Promise<MiniGameResult>;
}

/** Metadata for the four canonical modes (implementations TBD). */
export interface MiniGameDescriptor {
  readonly id: string;
  readonly name: string;
  readonly secondsPerPoint: number;
  /** Hard score cap, if any (Commuter World caps at 38). */
  readonly maxScore?: number;
  readonly summary: string;
}

export const MINI_GAMES: readonly MiniGameDescriptor[] = [
  {
    id: 'lazer-racer',
    name: 'Lazer Racer',
    secondsPerPoint: 1,
    summary: 'Lane-shifting dodge-car runner; +1 point per row of traffic cleared.',
  },
  {
    id: 'space-rocks',
    name: 'Space Rocks',
    secondsPerPoint: 1,
    summary: 'Asteroids homage; flippers rotate a ship that auto-fires every 0.5s.',
  },
  {
    id: 'ascender',
    name: 'Ascender',
    secondsPerPoint: 1,
    summary: 'Inverse-thrust UFO: hold to rise, release to fall; collect dots.',
  },
  {
    id: 'commuter-world',
    name: 'Commuter World',
    secondsPerPoint: 5,
    maxScore: 38,
    summary: 'Ghost-replay driving easter egg; records transforms into a Float32Array.',
  },
] as const;

/**
 * Host that suspends the main game, runs a mode, and returns banked seconds.
 * Wired by the Game; left abstract here so the core loop has a clean seam.
 */
export class MiniGameHost {
  private active = false;

  get isActive(): boolean {
    return this.active;
  }

  async play(game: MiniGame, container: HTMLElement): Promise<number> {
    this.active = true;
    try {
      const result = await game.run(container);
      return result.points * game.secondsPerPoint;
    } finally {
      this.active = false;
    }
  }
}
