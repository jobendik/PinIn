import { Config } from '@/config/GameConfig';
import { Biome, biomeForDistance, isOvertime } from '@/config/Biomes';
import { createRng, randRange, randInt } from '@/math/MathUtils';
import type { RailKind, RailPoint } from '@/entities/RailEntity';

/**
 * Declarative description of one vertical board of table. The generator emits
 * these from a seeded RNG (deterministic per index); the {@link LevelStreamer}
 * instantiates pooled entities from them.
 *
 * Layout per board, matching PinOut's structure (pinout.md / reference shots):
 * continuous winding side RAILS form a neon canyon that bends and pinches; at
 * each board base, curved FUNNEL rails sweep inward to a short flipper "V" with
 * open inlanes either side; POP BUMPERS deck the mid-board; and time DOTS line
 * the rails and a central arc. The wide upper channel lets a climbing ball pass
 * the flippers; a missed ball funnels back down onto them.
 */
export interface RailSpec {
  points: RailPoint[];
  kind: RailKind;
}
export interface BumperSpec {
  x: number;
  y: number;
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
  rails: RailSpec[];
  bumpers: BumperSpec[];
  dots: DotSpec[];
  powerups: PowerUpSpec[];
  flippers: FlipperSpec[];
  checkpointY: number | null;
}

const H = Config.level.chunkHeight;
const HALF = Config.level.laneWidth * 0.5;
const SEED = 0x9e3779b1;

/**
 * Continuous canyon edge — a smooth function of *absolute* Y so adjacent boards'
 * rails meet seamlessly. The whole channel bends left/right and pinches in/out.
 */
function edgeX(y: number, sign: number): number {
  // Gentle bend + slight pinch — a wide, flowing channel, never a tight gate.
  const bend = Math.sin(y * 0.009) * 3.4;
  const pinch = Math.sin(y * 0.02 + 1.3) * 1.0;
  return bend + sign * (HALF - 0.4 - pinch);
}

export function generateChunk(index: number): ChunkSpec {
  const baseY = index * H;
  const topY = baseY + H;
  const biome = biomeForDistance(baseY);
  const overtime = isOvertime(baseY);
  const rng = createRng(SEED ^ (index * 0x85ebca6b));

  const rails: RailSpec[] = [];
  const bumpers: BumperSpec[] = [];
  const dots: DotSpec[] = [];
  const powerups: PowerUpSpec[] = [];
  const flippers: FlipperSpec[] = [];

  // ---- Continuous winding side rails (the canyon walls). ----
  const samples = 9;
  const leftPts: RailPoint[] = [];
  const rightPts: RailPoint[] = [];
  for (let s = 0; s <= samples; s++) {
    const y = baseY + (s / samples) * H;
    leftPts.push({ x: edgeX(y, -1), y });
    rightPts.push({ x: edgeX(y, 1), y });
  }
  rails.push({ points: leftPts, kind: 'rail' });
  rails.push({ points: rightPts, kind: 'rail' });

  // ---- Flipper "V" at the board base (open inlanes + open centre). ----
  // No funnel walls: they choke the channel. The flippers sit low and small so
  // the climbing ball flows up the wide-open channel past them, and a missed
  // ball can settle back onto them to be re-launched.
  const flipperY = baseY + 6;
  const flipperGap = HALF * 1.1;
  flippers.push({ centerX: 0, y: flipperY, gap: flipperGap });

  // First board: a full-width floor rail so the ball can't fall out the bottom.
  if (index === 0) {
    rails.push({ kind: 'rail', points: [{ x: -HALF, y: baseY + 2 }, { x: HALF, y: baseY + 2 }] });
  }

  // ---- A single pop bumper, occasionally, tucked OFF the central climb line. ----
  // Rare and to the side: an accent, not a wall. The ball flows past it.
  if (!overtime && rng() < 0.5) {
    const side = rng() < 0.5 ? -1 : 1;
    const bx = side * randRange(rng, HALF * 0.5, HALF * 0.72);
    const by = baseY + randRange(rng, H * 0.45, H * 0.8);
    bumpers.push({ x: bx, y: by });
    for (let d = 0; d < 3; d++) {
      const a = Math.PI * (0.25 + d * 0.25);
      dots.push({ x: bx + Math.cos(a) * 3.0, y: by + 2.4 + Math.sin(a) * 1.4 });
    }
  }

  // ---- Dots strung along the side rails (the classic "rail of dots"). ----
  if (!overtime) {
    for (let s = 2; s <= samples - 1; s += 2) {
      const y = baseY + (s / samples) * H;
      const side = s % 4 === 0 ? -1 : 1;
      const ex = edgeX(y, side);
      dots.push({ x: ex - side * 2.4, y });
      dots.push({ x: ex - side * 2.4, y: y + H / samples / 2 });
    }
    // A gentle central arc to reward the straight climb.
    const arcY = baseY + H * 0.55;
    const arcN = randInt(rng, 3, 5);
    for (let i = 0; i < arcN; i++) {
      const t = arcN === 1 ? 0.5 : i / (arcN - 1);
      dots.push({ x: (t - 0.5) * 8, y: arcY + Math.sin(t * Math.PI) * 4 });
    }
  }

  // ---- Power-up orb (chance-based, tucked to one side). ----
  if (!overtime && rng() < biome.difficulty.powerupChance) {
    const side = rng() < 0.5 ? -1 : 1;
    const y = baseY + randRange(rng, H * 0.5, H * 0.85);
    powerups.push({ x: edgeX(y, side) - side * 3.2, y });
  }

  // ---- Checkpoint boundary (every 1000 distance). ----
  let checkpointY: number | null = null;
  const boundary = Math.ceil(baseY / 1000) * 1000;
  if (boundary >= baseY && boundary < topY && boundary > 0) checkpointY = boundary;

  return { index, baseY, topY, biome, rails, bumpers, dots, powerups, flippers, checkpointY };
}
