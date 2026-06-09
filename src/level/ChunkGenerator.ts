import { Config } from '@/config/GameConfig';
import { Biome, biomeForDistance, isOvertime } from '@/config/Biomes';
import { createRng, randRange } from '@/math/MathUtils';
import type { RailKind, RailPoint } from '@/level/railProps';

/**
 * Declarative description of one vertical board of table. The generator emits
 * these from a seeded RNG (deterministic per index); the {@link LevelStreamer}
 * instantiates pooled entities from them.
 *
 * PinOut's defining property is that every screen reads as a hand-built pinball
 * SHOT — curved lanes you aim into, with rows of time dots strung along them
 * like runway lights. So instead of one repeating funnel, each board is built
 * from a shared skeleton (one-way gate → flipper V → slingshots) plus one of
 * several ARCHETYPES that define the shot geometry of its middle:
 *
 *   twinRamps — the classic: two mirrored ramps arcing up the sides, both
 *               strung with dots, necking into the next gate.
 *   orbit     — one grand dotted sweep up a single side (the reward line),
 *               with a bumper pocket and a plain deflector lane opposite.
 *   island    — a diamond island splits the climb into two dotted lanes.
 *   nest      — a pop-bumper triangle mid-board with straighter side guides.
 *
 * The whole canyon meanders: every element is placed relative to the canyon
 * centreline `centreX(y)`, so geometry bends with the walls and never pokes
 * through them. Dots are laid ALONG the lane polylines (inset toward play) —
 * the signature PinOut look of dotted light-trails marking each route.
 *
 * The plunger (Game.ts) only re-serves a drained ball into play; it reaches
 * about half a board, so clearing a board is always earned with the flippers.
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

const H = Config.level.chunkHeight; // 40
const HALF = Config.level.laneWidth * 0.5; // 11
const SEED = 0x9e3779b1;
/** Lane half-width at the neck, just under each gate. */
const NECK_X = 1.9;
/** Local Y where all guide lanes converge (just below the next gate). */
const TOP = H - 2;

/** The canyon centreline meanders slowly — smooth in *absolute* Y. */
export function centreX(y: number): number {
  return Math.sin(y * 0.008) * 3.0;
}

function pinch(y: number): number {
  return Math.sin(y * 0.018 + 1.3) * 0.9;
}

/** Continuous canyon edge — boards meet seamlessly. */
export function edgeX(y: number, sign: number): number {
  return centreX(y) + sign * (HALF - 0.4 - pinch(y));
}

/** Everything an archetype needs to lay out the middle of a board. */
interface BoardCtx {
  baseY: number;
  rng: () => number;
  /** Alternating board side sign, for asymmetric layouts. */
  ps: number;
  overtime: boolean;
  rails: RailSpec[];
  bumpers: BumperSpec[];
  dots: DotSpec[];
  powerups: PowerUpSpec[];
}

/** A point at local (lx, ly), bent to follow the canyon centreline. */
function P(c: BoardCtx, lx: number, ly: number): RailPoint {
  const y = c.baseY + ly;
  return { x: centreX(y) + lx, y };
}

/**
 * String Extra Time Dots along a lane polyline at a fixed arc-length spacing,
 * inset slightly toward the centreline so they sit ON the playable side of the
 * rail — the PinOut "runway lights" read.
 */
function dotsAlong(points: RailPoint[], spacing: number, out: DotSpec[], inset = 1.15): void {
  let next = spacing * 0.5;
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    while (next <= acc + len) {
      const t = (next - acc) / len;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const toward = Math.sign(centreX(y) - x) || 1;
      out.push({ x: x + toward * inset, y });
      next += spacing;
    }
    acc += len;
  }
}

// ------------------------------------------------------------ archetypes --- //

/** The classic PinOut screen: mirrored ramps arcing into the neck, both dotted. */
function twinRamps(c: BoardCtx): void {
  for (const s of [-1, 1]) {
    const ramp: RailPoint[] = [
      P(c, s * 8.8, 13),
      P(c, s * 9.2, 19),
      P(c, s * 7.8, 26),
      P(c, s * 4.6, 33),
      P(c, s * NECK_X, TOP),
    ];
    c.rails.push({ kind: 'ramp', points: ramp });
    if (!c.overtime) dotsAlong(ramp, 3.4, c.dots);
  }
  c.bumpers.push(P(c, c.ps * 3.4, 22));
  if (!c.overtime) {
    c.dots.push(P(c, 0, 15.5), P(c, -c.ps * 2.2, 27), P(c, 0, 34.5));
  }
}

/** One grand dotted sweep up a single side; bumper pocket + plain lane opposite. */
function orbit(c: BoardCtx): void {
  const s = c.ps;
  const main: RailPoint[] = [
    P(c, s * 8.8, 11),
    P(c, s * 9.2, 17),
    P(c, s * 8.9, 25),
    P(c, s * 5.6, 32.5),
    P(c, s * NECK_X, TOP),
  ];
  c.rails.push({ kind: 'ramp', points: main });
  if (!c.overtime) dotsAlong(main, 3.0, c.dots);

  // The opposite wall carries a shorter, undotted deflector into the neck:
  // the safe line. The long dotted orbit is the reward line.
  const deflector: RailPoint[] = [
    P(c, -s * 8.8, 16),
    P(c, -s * 7.0, 27),
    P(c, -s * NECK_X, TOP),
  ];
  c.rails.push({ kind: 'ramp', points: deflector });
  c.bumpers.push(P(c, -s * 5.2, 14), P(c, -s * 3.2, 21));
  if (!c.overtime) c.dots.push(P(c, 0, 30), P(c, s * 0.9, 35));
}

/** A diamond island splits the climb into two dotted lanes that re-merge. */
function island(c: BoardCtx): void {
  const iy = 24;
  const diamond: RailPoint[] = [
    P(c, 0, iy - 5.2),
    P(c, 4.2, iy),
    P(c, 0, iy + 5.2),
    P(c, -4.2, iy),
    P(c, 0, iy - 5.2),
  ];
  c.rails.push({ kind: 'wall', points: diamond });
  for (const s of [-1, 1]) {
    const lane: RailPoint[] = [
      P(c, s * 8.8, 13),
      P(c, s * 8.2, 22),
      P(c, s * 6.6, 30),
      P(c, s * NECK_X, TOP),
    ];
    c.rails.push({ kind: 'ramp', points: lane });
    if (!c.overtime) dotsAlong(lane, 3.4, c.dots);
  }
  if (!c.overtime) c.dots.push(P(c, 0, 33.5));
}

/** A pop-bumper triangle mid-board with straighter side guides — the chaos board. */
function nest(c: BoardCtx): void {
  c.bumpers.push(P(c, -4.6, 19), P(c, 4.6, 19), P(c, 0, 26));
  for (const s of [-1, 1]) {
    const guide: RailPoint[] = [
      P(c, s * 8.8, 13),
      P(c, s * 8.4, 23),
      P(c, s * 5.2, 32),
      P(c, s * NECK_X, TOP),
    ];
    c.rails.push({ kind: 'ramp', points: guide });
    if (!c.overtime) dotsAlong(guide, 4.2, c.dots);
  }
  if (!c.overtime) {
    c.dots.push(P(c, -2.3, 22.5), P(c, 2.3, 22.5), P(c, 0, 31.5));
  }
}

const ARCHETYPES = [twinRamps, orbit, island, nest] as const;

// --------------------------------------------------------------- emitter --- //

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

  const ps = index % 2 === 0 ? 1 : -1;
  const c: BoardCtx = { baseY, rng, ps, overtime, rails, bumpers, dots, powerups };

  // ---- Continuous winding side walls (lively — the ball ricochets off them). ----
  const samples = 8;
  const leftPts: RailPoint[] = [];
  const rightPts: RailPoint[] = [];
  for (let s = 0; s <= samples; s++) {
    const y = baseY + (s / samples) * H;
    leftPts.push({ x: edgeX(y, -1), y });
    rightPts.push({ x: edgeX(y, 1), y });
  }
  rails.push({ points: leftPts, kind: 'wall' });
  rails.push({ points: rightPts, kind: 'wall' });

  // ---- One-way energy gate across the board base (the ratchet). ----
  const gateY = baseY + 0.5;
  rails.push({
    kind: 'gate',
    points: [
      { x: edgeX(gateY, -1), y: gateY },
      { x: edgeX(gateY, 1), y: gateY },
    ],
  });

  // ---- Flipper "V" just above the gate, with a central drain between tips. ----
  flippers.push({ centerX: centreX(baseY + 5), y: baseY + 5, gap: HALF * 1.05 });

  // ---- Slingshots above-outboard of each flipper (kick a ball back into play). ----
  rails.push({ kind: 'sling', points: [P(c, -8.8, 5.5), P(c, -6.2, 10.5)] });
  rails.push({ kind: 'sling', points: [P(c, 8.8, 5.5), P(c, 6.2, 10.5)] });

  // ---- The shot geometry of the board's middle: one of the archetypes. ----
  // Board 0 is always the classic twin-ramp screen (it teaches the game).
  const archetype = index === 0 ? twinRamps : ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
  archetype(c);

  // ---- Power-up orb (chance-based, tucked into a hard-to-reach corner). ----
  if (!overtime && rng() < biome.difficulty.powerupChance) {
    const ly = randRange(rng, H * 0.55, H * 0.78);
    powerups.push(P(c, -ps * (HALF - 3.4), ly));
  }

  // ---- Checkpoint boundary (every 1000 distance). ----
  let checkpointY: number | null = null;
  const boundary = Math.ceil(baseY / 1000) * 1000;
  if (boundary >= baseY && boundary < topY && boundary > 0) checkpointY = boundary;

  return { index, baseY, topY, biome, rails, bumpers, dots, powerups, flippers, checkpointY };
}
