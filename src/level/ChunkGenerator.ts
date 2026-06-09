import { Config } from '@/config/GameConfig';
import { Biome, biomeForDistance, isOvertime } from '@/config/Biomes';
import { createRng, randRange } from '@/math/MathUtils';
import type { RailKind, RailPoint } from '@/level/railProps';

/**
 * Declarative description of one vertical board of table. The generator emits
 * these from a seeded RNG (deterministic per index); the {@link LevelStreamer}
 * instantiates pooled entities from them.
 *
 * A board is a compact pinball SHOT-ZONE. The clean line is: flip the ball up
 * the open centre, into a forgiving FUNNEL that necks any decent upward shot
 * through the next board's one-way gate. Slingshots and a bumper pocket throw
 * energy back into play; the gate ratchets your progress so a miss only ever
 * drops you back onto your own flippers.
 *
 *   ┌──────────────── topY (= next board's one-way gate) ─────────────────┐
 *   │              ╲      neck → through the gate      ╱                    │
 *   │               ╲   left funnel    right funnel  ╱                      │
 *   │   ◌            ╲                              ╱            ◌  bumper   │
 *   │   dots ↑        ╲____  funnel mouth (wide) __╱               pocket   │
 *   │   ╱sling╲          (open centre climb lane)          ╱sling╲          │
 *   │     ╲ left flipper ╲           drain           ╱ right flipper ╱       │
 *   │ ════════════════ ONE-WAY ENERGY GATE ════════════════ (ratchet)       │
 *   └──────────────────────────── baseY ───────────────────────────────────┘
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

const H = Config.level.chunkHeight; // 44
const HALF = Config.level.laneWidth * 0.5; // 11
const SEED = 0x9e3779b1;

/** Continuous canyon edge — smooth in *absolute* Y so boards meet seamlessly. */
function edgeX(y: number, sign: number): number {
  const bend = Math.sin(y * 0.008) * 3.0;
  const pinch = Math.sin(y * 0.018 + 1.3) * 0.9;
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
  flippers.push({ centerX: 0, y: baseY + 5, gap: HALF * 1.05 });

  // ---- Slingshots above-outboard of each flipper (kick a ball back into play). ----
  rails.push({ kind: 'sling', points: [{ x: -9.0, y: baseY + 5.5 }, { x: -6.4, y: baseY + 10.5 }] });
  rails.push({ kind: 'sling', points: [{ x: 9.0, y: baseY + 5.5 }, { x: 6.4, y: baseY + 10.5 }] });

  // ---- The funnel: a wide, gently-necking V that LIFTS a shot to the gate. ----
  // Shallow slopes so an ascending ball glances along a wall (and is carried up
  // by the ramp lift) rather than slamming its underside and bouncing back. The
  // mouth stays wide and open low down so a freshly-served ball rises into the
  // throat instead of pinballing around the base, then it necks to just under
  // the next gate. Never vertical — parallel walls a ball-width apart let the
  // swept solver resolve to the wrong side and tunnel out.
  const neckX = 1.9;
  const funnelMouthY = baseY + 17;
  const funnelNeckY = baseY + H - 2; // just below the next gate
  const midY = (funnelMouthY + funnelNeckY) * 0.5;
  rails.push({
    kind: 'ramp',
    points: [
      { x: -8.6, y: funnelMouthY },
      { x: -4.3, y: midY },
      { x: -neckX, y: funnelNeckY },
    ],
  });
  rails.push({
    kind: 'ramp',
    points: [
      { x: 8.6, y: funnelMouthY },
      { x: 4.3, y: midY },
      { x: neckX, y: funnelNeckY },
    ],
  });

  // ---- Bumper pocket: off-centre, alternating side; adds chaos & dots. ----
  const ps = index % 2 === 0 ? 1 : -1;
  bumpers.push({ x: ps * 6.6, y: baseY + 22 });
  bumpers.push({ x: ps * 5.0, y: baseY + 13 });

  // ---- Dots: a column up the open centre (reward for the clean line). ----
  if (!overtime) {
    for (let dy = 14; dy <= H - 4; dy += 6) {
      dots.push({ x: 0, y: baseY + dy });
    }
    dots.push({ x: ps * 6.0, y: baseY + 17 }); // a tempting one by the bumpers
  }

  // ---- Power-up orb (chance-based, tucked into the bumper-pocket corner). ----
  if (!overtime && rng() < biome.difficulty.powerupChance) {
    const y = baseY + randRange(rng, H * 0.55, H * 0.78);
    powerups.push({ x: -ps * (HALF - 3.2), y });
  }

  // ---- Checkpoint boundary (every 1000 distance). ----
  let checkpointY: number | null = null;
  const boundary = Math.ceil(baseY / 1000) * 1000;
  if (boundary >= baseY && boundary < topY && boundary > 0) checkpointY = boundary;

  return { index, baseY, topY, biome, rails, bumpers, dots, powerups, flippers, checkpointY };
}
