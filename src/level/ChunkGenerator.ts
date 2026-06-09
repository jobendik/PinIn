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

function addDotLine(dots: DotSpec[], a: RailPoint, b: RailPoint, count: number): void {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    dots.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
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
  // The pivots sit close to the side walls, leaving a broad centre lane for a
  // climbing ball to pass through instead of becoming trapped under the bats.
  const flipperY = baseY + 7.5;
  const flipperGap = HALF * 1.52;
  flippers.push({ centerX: 0, y: flipperY, gap: flipperGap });

  // First board: a full-width floor rail so the ball can't fall out the bottom.
  if (index === 0) {
    rails.push({ kind: 'rail', points: [{ x: -HALF, y: baseY + 2 }, { x: HALF, y: baseY + 2 }] });
  }

  // ---- Return lanes around the flippers. ----
  // Short rails catch missed shots and aim them back at the side-mounted bats
  // without spanning across the playable centre channel.
  const leftInlane: RailPoint[] = [
    { x: edgeX(baseY + 4, -1) + 1.0, y: baseY + 4 },
    { x: -HALF * 0.82, y: flipperY + 0.5 },
    { x: -HALF * 0.58, y: flipperY + 5.2 },
  ];
  const rightInlane: RailPoint[] = [
    { x: edgeX(baseY + 4, 1) - 1.0, y: baseY + 4 },
    { x: HALF * 0.82, y: flipperY + 0.5 },
    { x: HALF * 0.58, y: flipperY + 5.2 },
  ];
  rails.push({ points: leftInlane, kind: 'rail' });
  rails.push({ points: rightInlane, kind: 'rail' });

  // ---- Raised sweep ramps. ----
  // Each board gets one PinOut-style diagonal ramp and, later on, a short return
  // ramp. They are offset from the centre line so they steer rather than block.
  const rampSide = index % 2 === 0 ? -1 : 1;
  const mainRamp: RailPoint[] = [
    { x: rampSide * HALF * 0.76, y: baseY + H * 0.25 },
    { x: rampSide * HALF * 0.42, y: baseY + H * 0.42 },
    { x: -rampSide * HALF * 0.08, y: baseY + H * 0.58 },
    { x: -rampSide * HALF * 0.42, y: baseY + H * 0.72 },
  ];
  rails.push({ points: mainRamp, kind: 'ramp' });
  if (!overtime) {
    addDotLine(dots, mainRamp[0], mainRamp[mainRamp.length - 1], 6);
  }

  if (biome.difficulty.tightness > 0.25) {
    const returnRamp: RailPoint[] = [
      { x: -rampSide * HALF * 0.72, y: baseY + H * 0.43 },
      { x: -rampSide * HALF * 0.48, y: baseY + H * 0.54 },
      { x: -rampSide * HALF * 0.16, y: baseY + H * 0.64 },
    ];
    rails.push({ points: returnRamp, kind: 'ramp' });
  }

  // ---- Pop-bumper islands. ----
  // Bumpers now appear as small side clusters with a guard rail, making the
  // boards read like pinball tables while preserving a clear central escape lane.
  if (!overtime) {
    const clusterSide = rng() < 0.5 ? -1 : 1;
    const clusterY = baseY + randRange(rng, H * 0.48, H * 0.68);
    const clusterX = clusterSide * randRange(rng, HALF * 0.42, HALF * 0.58);
    const bumperCount = randInt(rng, 2, 3);
    for (let i = 0; i < bumperCount; i++) {
      const angle = -Math.PI / 2 + (i / Math.max(1, bumperCount - 1)) * Math.PI;
      bumpers.push({
        x: clusterX + Math.cos(angle) * 2.8 * -clusterSide,
        y: clusterY + Math.sin(angle) * 3.0,
      });
    }
    rails.push({
      kind: 'rail',
      points: [
        { x: clusterX + clusterSide * 3.8, y: clusterY - 4.4 },
        { x: clusterX + clusterSide * 5.0, y: clusterY },
        { x: clusterX + clusterSide * 3.8, y: clusterY + 4.4 },
      ],
    });
    for (let d = 0; d < 5; d++) {
      const a = -0.9 + d * 0.45;
      dots.push({
        x: clusterX - clusterSide * (3.6 + Math.cos(a) * 1.4),
        y: clusterY + Math.sin(a) * 4.0,
      });
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
