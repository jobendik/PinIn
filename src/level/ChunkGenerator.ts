import { Config } from '@/config/GameConfig';
import { Biome, biomeForDistance, isOvertime } from '@/config/Biomes';
import { createRng, randRange, randInt } from '@/math/MathUtils';

/**
 * Declarative descriptions of a single vertical chunk of table. The generator
 * produces these from a seeded RNG; the {@link LevelStreamer} then instantiates
 * pooled entities from the spec. Keeping generation data-only makes the layout
 * deterministic (same chunk index → same layout) and trivially testable.
 */
export interface WallSpec {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: 'wall' | 'ramp' | 'bumper';
}
export interface DotSpec {
  x: number;
  y: number;
}
export interface PowerUpSpec {
  x: number;
  y: number;
}
export interface FlipperSpec {
  centerX: number;
  y: number;
  gap: number;
}
export interface ChunkSpec {
  index: number;
  baseY: number;
  topY: number;
  biome: Biome;
  walls: WallSpec[];
  dots: DotSpec[];
  powerups: PowerUpSpec[];
  flippers: FlipperSpec[];
  /** World-Y of a checkpoint boundary contained in this chunk, if any. */
  checkpointY: number | null;
}

const H = Config.level.chunkHeight;
const HALF = Config.level.laneWidth * 0.5;
const SEED = 0x9e3779b1;

/**
 * Generate the table layout for chunk `index`.
 *
 * Layout per chunk (bottom-to-top): a catcher flipper "V" near the base with
 * slingshot guides funnelling toward it, undulating side walls, interior
 * kicker ramps that carry dots, and an optional power-up tucked into a corner.
 * In Overtime, dots and power-ups are suppressed (blueprint §Progression).
 */
export function generateChunk(index: number): ChunkSpec {
  const baseY = index * H;
  const topY = baseY + H;
  const biome = biomeForDistance(baseY);
  const overtime = isOvertime(baseY);
  const rng = createRng(SEED ^ (index * 0x85ebca6b));

  const tightness = biome.difficulty.tightness;
  const half = HALF * (1 - 0.28 * tightness);

  const walls: WallSpec[] = [];
  const dots: DotSpec[] = [];
  const powerups: PowerUpSpec[] = [];
  const flippers: FlipperSpec[] = [];

  // ---- Undulating side walls (built from short segments for smooth curves). ----
  const segments = 8;
  const phase = index * 1.3;
  const wallX = (y: number, sign: number): number => {
    const wobble = Math.sin(y * 0.045 + phase) * (1.4 + tightness * 1.6);
    const drift = Math.sin(y * 0.013 + phase * 0.5) * 2.0 * (1 - tightness);
    return sign * half + sign * wobble + drift;
  };
  for (let s = 0; s < segments; s++) {
    const y0 = baseY + (s / segments) * H;
    const y1 = baseY + ((s + 1) / segments) * H;
    walls.push({ ax: wallX(y0, -1), ay: y0, bx: wallX(y1, -1), by: y1, kind: 'wall' });
    walls.push({ ax: wallX(y0, 1), ay: y0, bx: wallX(y1, 1), by: y1, kind: 'wall' });
  }

  // ---- Catcher flipper "V" near the chunk base. ----
  // The pivot gap is tuned so the resting tips nearly meet at the centre: a ball
  // falling down the channel is caught by the V (and can be re-launched) rather
  // than draining straight through, while open side lanes between each pivot and
  // the wall let a climbing ball travel upward past the flippers.
  const flipperY = baseY + 6.5;
  const flipperGap = HALF * 1.28;
  flippers.push({ centerX: 0, y: flipperY, gap: flipperGap });

  // Slingshot guide bumpers just outside each pivot, angled inward, that kick a
  // climbing ball back toward play (and keep it out of the dead outer corners).
  const guideX = flipperGap * 0.5 + 2.2;
  walls.push({ ax: -guideX, ay: flipperY + 11, bx: -guideX + 2.0, by: flipperY + 3.5, kind: 'bumper' });
  walls.push({ ax: guideX, ay: flipperY + 11, bx: guideX - 2.0, by: flipperY + 3.5, kind: 'bumper' });

  // The very first chunk gets a full-width floor: a final safety net beneath the
  // launch V so the ball can never fall out the bottom of the world at y < 0.
  if (index === 0) {
    walls.push({ ax: -half, ay: baseY + 1.5, bx: half, by: baseY + 1.5, kind: 'ramp' });
  }

  // ---- Interior kicker ramps carrying dots. ----
  const rampCount = 1 + (index % 2) + Math.round(tightness);
  for (let r = 0; r < rampCount; r++) {
    const ry = baseY + randRange(rng, 18, H - 8);
    const side = rng() < 0.5 ? -1 : 1;
    const innerX = randRange(rng, 1, half * 0.4);
    const outerX = side * randRange(rng, half * 0.55, half * 0.92);
    walls.push({
      ax: side * innerX,
      ay: ry,
      bx: outerX,
      by: ry + randRange(rng, 4, 9),
      kind: 'ramp',
    });

    // Dots strung along the ramp face.
    if (!overtime) {
      const dotCount = randInt(rng, 3, 7);
      for (let d = 0; d < dotCount; d++) {
        const t = d / Math.max(1, dotCount - 1);
        dots.push({
          x: side * innerX + (outerX - side * innerX) * t,
          y: ry + 1.4 + (randRange(rng, 4, 9) * t) * 0.25,
        });
      }
      // Reward backtracking-rich ramps with a denser cluster occasionally.
      if (rng() < 0.25) {
        for (let d = 0; d < randInt(rng, 4, 8); d++) {
          dots.push({ x: randRange(rng, -half * 0.7, half * 0.7), y: ry + randRange(rng, -2, 6) });
        }
      }
    }
  }

  // ---- A free-floating dot arc through the open channel. ----
  if (!overtime) {
    const arcY = baseY + H * 0.5;
    const arcCount = randInt(rng, 4, 8);
    for (let i = 0; i < arcCount; i++) {
      const t = arcCount === 1 ? 0.5 : i / (arcCount - 1);
      dots.push({
        x: (t - 0.5) * 2 * half * 0.7,
        y: arcY + Math.sin(t * Math.PI) * 6,
      });
    }
  }

  // ---- Power-up orb (chance-based, tucked into an upper corner). ----
  if (!overtime && rng() < biome.difficulty.powerupChance) {
    const side = rng() < 0.5 ? -1 : 1;
    powerups.push({ x: side * half * 0.78, y: baseY + randRange(rng, H * 0.55, H * 0.9) });
  }

  // ---- Checkpoint boundary (every 1000 distance). ----
  let checkpointY: number | null = null;
  const lowerK = Math.ceil(baseY / 1000);
  const boundary = lowerK * 1000;
  if (boundary >= baseY && boundary < topY && boundary > 0) {
    checkpointY = boundary;
  }

  return { index, baseY, topY, biome, walls, dots, powerups, flippers, checkpointY };
}
