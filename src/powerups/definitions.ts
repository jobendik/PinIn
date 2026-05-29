import type { PowerUpDef } from './types';

/**
 * The power-up catalogue. Durations and effects follow the blueprint's table:
 * Slow Motion (20s), Time Freeze (10 flips), Motion Link (15s), Push (15s),
 * Warp Drive (instant), Time Doubler (40s), and Random (delegates).
 */
export const POWERUPS: readonly PowerUpDef[] = [
  {
    id: 'slow-motion',
    name: 'Slow Motion',
    icon: '🐢',
    description: 'Slows the whole simulation — and the clock with it — for 20s.',
    duration: { kind: 'time', amount: 20 },
    onActivate: (rt) => (rt.physicsTimeScale = 0.5),
    onExpire: (rt) => (rt.physicsTimeScale = 1),
  },
  {
    id: 'time-freeze',
    name: 'Time Freeze',
    icon: '❄️',
    description: 'Freezes the master clock until you flip 10 times.',
    duration: { kind: 'flips', amount: 10 },
    onActivate: (rt) => {
      rt.timerFrozen = true;
      rt.freezeFlips = 10;
    },
    onExpire: (rt) => {
      rt.timerFrozen = false;
      rt.freezeFlips = 0;
    },
  },
  {
    id: 'motion-link',
    name: 'Motion Link',
    icon: '🔗',
    description: 'Time only passes while the ball is moving. Lasts 15s.',
    duration: { kind: 'time', amount: 15 },
    onActivate: (rt) => (rt.motionLink = true),
    onExpire: (rt) => (rt.motionLink = false),
  },
  {
    id: 'push',
    name: 'Push',
    icon: '👆',
    description: 'Swipe to shove the ball directly, bypassing the flippers. 15s.',
    duration: { kind: 'time', amount: 15 },
    onActivate: (rt) => (rt.pushMode = true),
    onExpire: (rt) => (rt.pushMode = false),
  },
  {
    id: 'warp-drive',
    name: 'Warp Drive',
    icon: '🚀',
    description: 'Instantly warps the ball 100 units up the canyon.',
    duration: { kind: 'instant', amount: 0 },
    onActivate: (rt) => rt.requestWarp(100),
    onExpire: () => {},
  },
  {
    id: 'time-doubler',
    name: 'Time Doubler',
    icon: '⏱×2',
    description: 'Every Extra Time Dot is worth +2 seconds for 40s.',
    duration: { kind: 'time', amount: 40 },
    onActivate: (rt) => (rt.dotMultiplier = 2),
    onExpire: (rt) => (rt.dotMultiplier = 1),
  },
  {
    id: 'random',
    name: 'Random',
    icon: '🎲',
    description: 'Rolls the dice — applies a random power-up instantly.',
    duration: { kind: 'instant', amount: 0 },
    onActivate: (rt) => {
      const pool = POWERUPS.filter((p) => p.id !== 'random');
      // Deterministic-ish pick from ball-independent state isn't required here;
      // a plain random selection is fine for a one-shot consumable.
      const choice = pool[Math.floor(Math.random() * pool.length)];
      rt.activate(choice.id);
    },
    onExpire: () => {},
  },
] as const;

export const POWERUP_BY_ID = new Map(POWERUPS.map((p) => [p.id, p]));
