/**
 * Persistent storage via localStorage (blueprint §Progression / Monetization).
 *
 * Two things survive a page reload: the best distance ever reached, and a
 * checkpoint snapshot. The snapshot records the player's exact remaining time
 * and distance at the moment they last crossed a 1,000 boundary, so a "continue"
 * resumes with that time — never a fresh 60s — preserving the temporal economy.
 */
export interface CheckpointSnapshot {
  distance: number;
  remaining: number;
  /** World-Y to respawn the ball at. */
  spawnY: number;
}

const KEY_BEST = 'pinin.best';
const KEY_CHECKPOINT = 'pinin.checkpoint';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable (private mode); fail silently */
  }
}

export const SaveManager = {
  getBest(): number {
    const raw = safeGet(KEY_BEST);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  },

  setBest(distance: number): number {
    const best = Math.max(this.getBest(), Math.floor(distance));
    safeSet(KEY_BEST, String(best));
    return best;
  },

  saveCheckpoint(snapshot: CheckpointSnapshot): void {
    safeSet(KEY_CHECKPOINT, JSON.stringify(snapshot));
  },

  getCheckpoint(): CheckpointSnapshot | null {
    const raw = safeGet(KEY_CHECKPOINT);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as CheckpointSnapshot;
      if (typeof data.distance === 'number' && typeof data.remaining === 'number') {
        return data;
      }
    } catch {
      /* corrupt — ignore */
    }
    return null;
  },

  clearCheckpoint(): void {
    try {
      localStorage.removeItem(KEY_CHECKPOINT);
    } catch {
      /* ignore */
    }
  },
};
