import { bus } from '@/core/EventBus';
import type { Ball } from '@/physics/Ball';
import type { PowerUpDef, PowerUpRuntime } from './types';
import { POWERUPS, POWERUP_BY_ID } from './definitions';
import { createRng, randInt } from '@/math/MathUtils';

interface ActivePowerUp {
  def: PowerUpDef;
  /** Remaining seconds for time-based power-ups. */
  remaining: number;
}

/**
 * Owns every global state override a power-up can apply, and ticks their
 * durations. The game loop reads {@link physicsTimeScale} (to scale the sim and
 * the master clock), {@link dotMultiplier}, the timer-gating flags, and
 * {@link pushMode} — so power-ups never reach into other systems directly.
 */
export class PowerUpManager implements PowerUpRuntime {
  physicsTimeScale = 1;
  dotMultiplier = 1;
  timerFrozen = false;
  freezeFlips = 0;
  motionLink = false;
  pushMode = false;

  /** Set by the Game so Warp Drive can also re-target the camera. */
  warpHandler: ((dy: number) => void) | null = null;

  private readonly activeList: ActivePowerUp[] = [];
  private rng = createRng(0x1234abcd);

  reset(): void {
    this.physicsTimeScale = 1;
    this.dotMultiplier = 1;
    this.timerFrozen = false;
    this.freezeFlips = 0;
    this.motionLink = false;
    this.pushMode = false;
    this.activeList.length = 0;
  }

  /** Offer the player two random distinct choices (binary modal). */
  offerChoices(): [PowerUpDef, PowerUpDef] {
    const a = randInt(this.rng, 0, POWERUPS.length - 1);
    let b = randInt(this.rng, 0, POWERUPS.length - 1);
    if (b === a) b = (b + 1) % POWERUPS.length;
    const choices: [PowerUpDef, PowerUpDef] = [POWERUPS[a], POWERUPS[b]];
    bus.emit('powerup:offered', { choices: [choices[0].id, choices[1].id] });
    return choices;
  }

  activate(id: string): void {
    const def = POWERUP_BY_ID.get(id);
    if (!def) return;

    // Refresh duration if the same power-up is re-activated.
    const existing = this.activeList.find((a) => a.def.id === def.id);
    def.onActivate(this);

    if (def.duration.kind === 'instant') {
      def.onExpire(this);
      bus.emit('powerup:activated', { id });
      bus.emit('powerup:expired', { id });
      return;
    }
    if (existing) {
      existing.remaining = def.duration.amount;
    } else {
      this.activeList.push({ def, remaining: def.duration.amount });
    }
    bus.emit('powerup:activated', { id });
  }

  requestWarp(dy: number): void {
    this.warpHandler?.(dy);
  }

  /** Called whenever a flipper is actuated — drives Time Freeze's flip count. */
  notifyFlip(): void {
    if (this.freezeFlips > 0) {
      this.freezeFlips--;
      if (this.freezeFlips === 0) this.expire('time-freeze');
    }
  }

  /** True if the master clock should decrement this step. */
  shouldTimerTick(ball: Ball): boolean {
    if (this.timerFrozen) return false;
    if (this.motionLink && ball.velocity.lengthSq() < 4) return false; // ~2 u/s epsilon
    return true;
  }

  /** Tick time-based durations. Call from the fixed-step update. */
  fixedUpdate(dt: number): void {
    // Time-based power-ups slow alongside the simulation (Slow Motion stacks
    // with itself sanely because we tick by scaled dt).
    const scaled = dt * this.physicsTimeScale;
    for (let i = this.activeList.length - 1; i >= 0; i--) {
      const a = this.activeList[i];
      if (a.def.duration.kind !== 'time') continue;
      a.remaining -= scaled;
      if (a.remaining <= 0) this.expireAt(i);
    }
  }

  private expire(id: string): void {
    const idx = this.activeList.findIndex((a) => a.def.id === id);
    if (idx >= 0) this.expireAt(idx);
  }

  private expireAt(index: number): void {
    const a = this.activeList[index];
    a.def.onExpire(this);
    this.activeList.splice(index, 1);
    bus.emit('powerup:expired', { id: a.def.id });
  }

  /** Currently-active power-up ids, for the HUD badge. */
  get activeIds(): string[] {
    return this.activeList.map((a) => a.def.id);
  }
}
