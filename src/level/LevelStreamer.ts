import * as THREE from 'three';
import { Config } from '@/config/GameConfig';
import { ObjectPool } from '@/core/ObjectPool';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { RailEntity } from '@/entities/RailEntity';
import { BumperEntity } from '@/entities/BumperEntity';
import { DotEntity } from '@/entities/DotEntity';
import { PowerUpEntity } from '@/entities/PowerUpEntity';
import { FlipperPair } from '@/entities/FlipperPair';
import { generateChunk, type ChunkSpec, type RailSpec } from './ChunkGenerator';

interface ActiveChunk {
  spec: ChunkSpec;
  rails: RailEntity[];
  bumpers: BumperEntity[];
  dots: DotEntity[];
  powerups: PowerUpEntity[];
  flippers: FlipperPair[];
}

/**
 * Streams the infinite vertical canyon in and out of a fixed pool of entities.
 *
 * As the camera climbs, boards ahead are instantiated from {@link generateChunk}
 * specs by borrowing pooled rails / bumpers / dots / power-ups / flippers;
 * boards that fall far below are recycled. The live entity count — and thus the
 * memory footprint — stays flat, so the GC never stutters mid-run.
 */
export class LevelStreamer {
  private readonly railPool: ObjectPool<RailEntity>;
  private readonly bumperPool: ObjectPool<BumperEntity>;
  private readonly dotPool: ObjectPool<DotEntity>;
  private readonly powerupPool: ObjectPool<PowerUpEntity>;
  private readonly flipperPairs: FlipperPair[] = [];
  private readonly freeFlippers: FlipperPair[] = [];

  private readonly active = new Map<number, ActiveChunk>();
  /** Live sensors, exposed for overlap checks by the gameplay layer. */
  readonly activeDots = new Set<DotEntity>();
  readonly activePowerups = new Set<PowerUpEntity>();
  private readonly activeBumpers = new Set<BumperEntity>();

  private readonly chunkHeight = Config.level.chunkHeight;

  constructor(scene: THREE.Object3D, world: PhysicsWorld) {
    this.railPool = new ObjectPool(() => new RailEntity(scene, world), Config.pools.rails);
    this.bumperPool = new ObjectPool(() => new BumperEntity(scene, world), Config.pools.bumpers);
    this.dotPool = new ObjectPool(() => new DotEntity(scene), Config.pools.dots);
    this.powerupPool = new ObjectPool(() => new PowerUpEntity(scene), Config.pools.powerups);

    const pairCount = Config.level.spawnAheadChunks + Math.ceil(Config.level.recycleBehind / this.chunkHeight) + 4;
    for (let i = 0; i < pairCount; i++) {
      const pair = new FlipperPair(scene, world);
      this.flipperPairs.push(pair);
      this.freeFlippers.push(pair);
    }
  }

  /** Every flipper pair currently placed in the world (for input dispatch). */
  get allFlipperPairs(): readonly FlipperPair[] {
    return this.flipperPairs;
  }

  /** Recycle everything and regenerate from the chunk containing `startY`. */
  reset(startY: number): void {
    for (const idx of [...this.active.keys()]) this.recycleChunk(idx);
    this.active.clear();
    this.activeDots.clear();
    this.activePowerups.clear();
    this.activeBumpers.clear();
    this.update(startY, true);
  }

  /** Stream chunks around the camera. `force` regenerates immediately. */
  update(cameraY: number, force = false): void {
    const high = Math.floor(cameraY / this.chunkHeight) + Config.level.spawnAheadChunks;
    const low = Math.max(0, Math.floor((cameraY - Config.level.recycleBehind) / this.chunkHeight));

    for (const idx of [...this.active.keys()]) {
      if (idx < low || idx > high + 1) this.recycleChunk(idx);
    }

    // Spread generation across frames unless forced; break only after actually
    // creating a board so climbing keeps generating ground ahead.
    for (let idx = low; idx <= high; idx++) {
      if (this.active.has(idx)) continue;
      this.instantiateChunk(idx);
      if (!force) break;
    }
  }

  /**
   * PinOut colour language: boundary walls carry the biome's primary accent,
   * shot lanes/ramps the secondary, slingshots flash white-hot, and the gate
   * stays a dim accent strip — so each element class reads at a glance.
   */
  private railColor(rail: RailSpec, spec: ChunkSpec): number {
    switch (rail.kind) {
      case 'ramp':
        return spec.biome.accentB;
      case 'sling':
        return 0xffffff;
      default:
        return spec.biome.accent;
    }
  }

  private instantiateChunk(index: number): void {
    const spec = generateChunk(index);
    const chunk: ActiveChunk = { spec, rails: [], bumpers: [], dots: [], powerups: [], flippers: [] };

    for (const r of spec.rails) {
      const rail = this.railPool.acquire();
      if (!rail) break;
      rail.configure(r.points, r.kind, this.railColor(r, spec));
      chunk.rails.push(rail);
    }
    for (const b of spec.bumpers) {
      const bumper = this.bumperPool.acquire();
      if (!bumper) break;
      bumper.configure(b.x, b.y, spec.biome.accentB);
      this.activeBumpers.add(bumper);
      chunk.bumpers.push(bumper);
    }
    for (const d of spec.dots) {
      const dot = this.dotPool.acquire();
      if (!dot) break;
      dot.configure(d.x, d.y, spec.biome.accent);
      this.activeDots.add(dot);
      chunk.dots.push(dot);
    }
    for (const p of spec.powerups) {
      const orb = this.powerupPool.acquire();
      if (!orb) break;
      orb.configure(p.x, p.y, spec.biome.accentB);
      this.activePowerups.add(orb);
      chunk.powerups.push(orb);
    }
    for (const f of spec.flippers) {
      const pair = this.freeFlippers.pop();
      if (!pair) break;
      pair.place(f.centerX, f.y, f.gap, spec.biome.accent);
      chunk.flippers.push(pair);
    }

    this.active.set(index, chunk);
  }

  private recycleChunk(index: number): void {
    const chunk = this.active.get(index);
    if (!chunk) return;
    for (const r of chunk.rails) this.railPool.release(r);
    for (const b of chunk.bumpers) {
      this.activeBumpers.delete(b);
      this.bumperPool.release(b);
    }
    for (const d of chunk.dots) {
      this.activeDots.delete(d);
      this.dotPool.release(d);
    }
    for (const p of chunk.powerups) {
      this.activePowerups.delete(p);
      this.powerupPool.release(p);
    }
    for (const pair of chunk.flippers) {
      pair.deactivate();
      this.freeFlippers.push(pair);
    }
    this.active.delete(index);
  }

  /** Variable-step idle animation for dots / power-ups / bumpers (cosmetic). */
  animate(dt: number): void {
    for (const dot of this.activeDots) dot.animate(dt);
    for (const orb of this.activePowerups) orb.animate(dt);
    for (const bumper of this.activeBumpers) bumper.animate(dt);
  }
}
