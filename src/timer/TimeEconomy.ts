import { Config } from '@/config/GameConfig';
import { bus } from '@/core/EventBus';
import { biomeForDistance, rankForDistance } from '@/config/Biomes';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import type { LevelStreamer } from '@/level/LevelStreamer';
import type { PowerUpManager } from '@/powerups/PowerUpManager';

/**
 * The temporal economy — the only currency in the game (blueprint §Temporal
 * Economy). Runs in the fixed-step so dot collection and the master countdown
 * are deterministic. Time is granted by dots (+1, or +2 with Time Doubler) and
 * checkpoint crossings (+25, once each), and depletes continuously unless a
 * power-up gates it. Reaching 0 ends the run.
 */
export class TimeEconomy {
  remaining: number = Config.time.start;
  distance = 0;
  rank = rankForDistance(0);
  private biomeId = biomeForDistance(0).id;
  private nextCheckpoint = 1000;
  private dangerActive = false;
  private ended = false;
  /** World-Y of the spawn point; distance is measured relative to it. */
  private offset = 0;

  constructor(
    private readonly world: PhysicsWorld,
    private readonly streamer: LevelStreamer,
    private readonly powerups: PowerUpManager,
  ) {}

  reset(remaining: number = Config.time.start, distance = 0, offset = 0): void {
    this.remaining = remaining;
    this.distance = distance;
    this.offset = offset;
    this.rank = rankForDistance(distance);
    this.biomeId = biomeForDistance(distance).id;
    this.nextCheckpoint = (Math.floor(distance / 1000) + 1) * 1000;
    this.dangerActive = false;
    this.ended = false;
    bus.emit('time:changed', { remaining: this.remaining });
    bus.emit('distance:changed', { distance: this.distance, rank: this.rank });
  }

  get isOver(): boolean {
    return this.ended;
  }

  fixedUpdate(dt: number): void {
    if (this.ended) return;
    const ball = this.world.ball;

    this.updateDistance();
    this.checkCheckpoints();
    this.checkDots();
    this.checkPowerups();

    // Master countdown — scaled by Slow Motion, gated by Time Freeze/Motion Link.
    if (this.powerups.shouldTimerTick(ball)) {
      this.remaining -= dt * this.powerups.physicsTimeScale;
      bus.emit('time:changed', { remaining: Math.max(0, this.remaining) });

      const danger = this.remaining <= Config.time.dangerThreshold;
      if (danger !== this.dangerActive) {
        this.dangerActive = danger;
      }
      if (this.remaining <= 0) {
        this.remaining = 0;
        this.endRun();
      }
    }
  }

  private updateDistance(): void {
    const dist = Math.max(0, Math.floor(this.world.ball.maxY - this.offset));
    if (dist <= this.distance) return;
    this.distance = dist;
    this.rank = rankForDistance(dist);
    bus.emit('distance:changed', { distance: dist, rank: this.rank });

    const biome = biomeForDistance(dist);
    if (biome.id !== this.biomeId) {
      this.biomeId = biome.id;
      bus.emit('biome:changed', { id: biome.id, name: biome.name, rank: biome.rank });
    }
  }

  private checkCheckpoints(): void {
    // Bulk +25s per 1,000-distance boundary, granted once (max-Y gated so
    // falling back and re-crossing can't farm it — blueprint §Temporal Economy).
    while (this.distance >= this.nextCheckpoint) {
      this.grant(Config.time.checkpointBonus);
      const biome = biomeForDistance(this.nextCheckpoint);
      bus.emit('checkpoint:crossed', {
        bonus: Config.time.checkpointBonus,
        distance: this.nextCheckpoint,
        biomeName: biome.name,
      });
      this.nextCheckpoint += 1000;
    }
  }

  private checkDots(): void {
    const ball = this.world.ball;
    const reach = ball.radius;
    for (const dot of this.streamer.activeDots) {
      if (dot.collected) continue;
      const r = dot.radius + reach;
      if (ball.position.distanceSqTo(dot.position) <= r * r) {
        dot.collect();
        const value = Config.time.dotBonus * this.powerups.dotMultiplier;
        this.grant(value);
        bus.emit('dot:collected', { value, x: dot.position.x, y: dot.position.y });
      }
    }
  }

  private checkPowerups(): void {
    const ball = this.world.ball;
    const reach = ball.radius;
    for (const orb of this.streamer.activePowerups) {
      if (orb.collected) continue;
      const r = orb.radius + reach;
      if (ball.position.distanceSqTo(orb.position) <= r * r) {
        orb.collect();
        // The Game listens for this to pause and show the binary choice modal.
        const [a, b] = this.powerups.offerChoices();
        void a;
        void b;
      }
    }
  }

  grant(seconds: number): void {
    this.remaining += seconds;
    bus.emit('time:changed', { remaining: this.remaining });
  }

  private endRun(): void {
    this.ended = true;
  }
}
