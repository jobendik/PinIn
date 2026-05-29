/**
 * A tiny strongly-typed publish/subscribe bus.
 *
 * Decouples the physics/gameplay systems from rendering, audio, and UI: a
 * collision callback emits `dot:collected` and whatever cares (timer, audio,
 * particles, HUD) listens, with no direct references between them.
 */
export type GameEvents = {
  'game:start': void;
  'game:over': { distance: number; best: number };
  'game:restart': void;

  'ball:spawn': { x: number; y: number };
  'ball:collide': { speed: number; nx: number; ny: number; x: number; y: number };
  'ball:nudge': void;

  'flipper:actuate': { side: 'left' | 'right' };

  'dot:collected': { value: number; x: number; y: number };
  'checkpoint:crossed': { bonus: number; distance: number; biomeName: string };
  'biome:changed': { id: string; name: string; rank: string };

  'powerup:offered': { choices: string[] };
  'powerup:activated': { id: string };
  'powerup:expired': { id: string };

  'time:changed': { remaining: number };
  'distance:changed': { distance: number; rank: string };
};

type EventKey = keyof GameEvents;
type Handler<K extends EventKey> = (payload: GameEvents[K]) => void;

export class EventBus {
  private readonly handlers = new Map<EventKey, Set<Handler<EventKey>>>();

  on<K extends EventKey>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<EventKey>);
    return () => this.off(event, handler);
  }

  off<K extends EventKey>(event: K, handler: Handler<K>): void {
    this.handlers.get(event)?.delete(handler as Handler<EventKey>);
  }

  emit<K extends EventKey>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Iterate a copy so handlers can safely unsubscribe during dispatch.
    for (const handler of [...set]) {
      (handler as Handler<K>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** A single shared bus instance for the running game. */
export const bus = new EventBus();
