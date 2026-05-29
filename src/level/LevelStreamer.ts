import * as THREE from 'three';
import { Config } from '@/config/GameConfig';
import { ObjectPool } from '@/core/ObjectPool';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { WallEntity } from '@/entities/WallEntity';
import { DotEntity } from '@/entities/DotEntity';
import { PowerUpEntity } from '@/entities/PowerUpEntity';
import { FlipperPair } from '@/entities/FlipperPair';
import { generateChunk, type ChunkSpec } from './ChunkGenerator';

interface ActiveChunk {
  spec: ChunkSpec;
  walls: WallEntity[];
  dots: DotEntity[];
  powerups: PowerUpEntity[];
  flippers: FlipperPair[];
}

/**
 * Streams the infinite vertical table in and out of a fixed pool of entities.
 *
 * As the camera climbs, chunks ahead are instantiated from {@link generateChunk}
 * specs by borrowing pooled walls/dots/power-ups/flippers; chunks that fall far
 * below the camera are recycled. The total live entity count — and therefore
 * the memory footprint — stays flat, so the GC never stutters mid-run
 * (blueprint §HTML5 Optimization).
 */
export class LevelStreamer {
  private readonly wallPool: ObjectPool<WallEntity>;
  private readonly dotPool: ObjectPool<DotEntity>;
  private readonly powerupPool: ObjectPool<PowerUpEntity>;
  private readonly flipperPairs: FlipperPair[] = [];
  private readonly freeFlippers: FlipperPair[] = [];

  private readonly active = new Map<number, ActiveChunk>();
  /** Live sensors, exposed for overlap checks by the gameplay layer. */
  readonly activeDots = new Set<DotEntity>();
  readonly activePowerups = new Set<PowerUpEntity>();

  private readonly chunkHeight = Config.level.chunkHeight;

  constructor(scene: THREE.Scene, world: PhysicsWorld) {
    this.wallPool = new ObjectPool(() => new WallEntity(scene, world), Config.pools.walls);
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
    this.update(startY, true);
  }

  /** Stream chunks around the camera. `force` regenerates immediately. */
  update(cameraY: number, force = false): void {
    const high = Math.floor(cameraY / this.chunkHeight) + Config.level.spawnAheadChunks;
    const low = Math.max(0, Math.floor((cameraY - Config.level.recycleBehind) / this.chunkHeight));

    // Recycle chunks that scrolled out below.
    for (const idx of [...this.active.keys()]) {
      if (idx < low || idx > high + 1) this.recycleChunk(idx);
    }

    // Instantiate missing chunks. When forced (reset/warp) build the whole
    // range at once; otherwise spread work out — one new chunk per frame is
    // plenty given the spawn-ahead headroom — and only break *after* actually
    // creating one, so climbing keeps generating ground ahead.
    for (let idx = low; idx <= high; idx++) {
      if (this.active.has(idx)) continue;
      this.instantiateChunk(idx);
      if (!force) break;
    }
  }

  private instantiateChunk(index: number): void {
    const spec = generateChunk(index);
    const chunk: ActiveChunk = { spec, walls: [], dots: [], powerups: [], flippers: [] };

    for (const w of spec.walls) {
      const wall = this.wallPool.acquire();
      if (!wall) break;
      wall.configure(w.ax, w.ay, w.bx, w.by, w.kind, spec.biome.accent);
      chunk.walls.push(wall);
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
    for (const w of chunk.walls) this.wallPool.release(w);
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

  /** Variable-step idle animation for dots/power-ups (purely cosmetic). */
  animate(dt: number): void {
    for (const dot of this.activeDots) dot.animate(dt);
    for (const orb of this.activePowerups) orb.animate(dt);
  }
}
