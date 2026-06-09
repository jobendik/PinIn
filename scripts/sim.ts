/**
 * Headless validation sim for PinIn.
 *
 * Uses the REAL game code — PhysicsWorld, Flipper, Segment, railPhysics, and
 * generateChunk — with no Three.js. It streams boards exactly like the
 * LevelStreamer (one Segment per polyline edge, same collider params), serves
 * the ball with the real plunger values, and plays with a simple bot: hold the
 * flipper under the ball whenever it falls into the lower board.
 *
 * Pass criteria:
 *   1. CLIMB    — the bot reaches maxY ≥ 80 (2+ boards) within the time budget.
 *   2. CONTAIN  — the ball never tunnels: |x − centreX(y)| < HALF + 1.5, y > −5.
 *   3. VARIETY  — all four archetypes appear within the first 24 boards.
 *   4. BUDGETS  — per-board entity counts fit the pools in GameConfig.
 */
import { Config } from '@/config/GameConfig';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { Flipper } from '@/physics/Flipper';
import { Segment } from '@/physics/Segment';
import { CircleCollider } from '@/physics/CircleCollider';
import { railPhysics } from '@/level/railProps';
import { generateChunk, centreX, type ChunkSpec } from '@/level/ChunkGenerator';

const H = Config.level.chunkHeight;
const HALF = Config.level.laneWidth * 0.5;
const BUMPER_RADIUS = 1.5; // mirrors BumperEntity
const DT = Config.physics.fixedDt;
const TIME_BUDGET = 150; // sim-seconds
const TARGET_Y = 80; // ≥ 2 boards cleared

// ----------------------------------------------------------- streaming --- //

interface LiveChunk {
  spec: ChunkSpec;
  segments: Segment[];
  bumpers: CircleCollider[];
  flippers: Flipper[];
}

const world = new PhysicsWorld();
const live = new Map<number, LiveChunk>();
const archetypesSeen = new Set<string>();
const budgetFailures: string[] = [];

function classifyArchetype(spec: ChunkSpec): string {
  // Skeleton = 2 walls + 1 gate + 2 slings = 5 rails. Identify by the middle.
  const mid = spec.rails.slice(5);
  const ramps = mid.filter((r) => r.kind === 'ramp').length;
  const walls = mid.filter((r) => r.kind === 'wall').length;
  if (walls === 1) return 'island';
  if (spec.bumpers.length === 3) return 'nest';
  if (ramps === 2 && spec.bumpers.length === 1) return 'twinRamps';
  if (ramps === 2 && spec.bumpers.length === 2) return 'orbit';
  return `unknown(ramps=${ramps},walls=${walls},bumpers=${spec.bumpers.length})`;
}

function instantiate(index: number): void {
  if (live.has(index) || index < 0) return;
  const spec = generateChunk(index);
  const chunk: LiveChunk = { spec, segments: [], bumpers: [], flippers: [] };

  for (const r of spec.rails) {
    const phys = railPhysics(r.kind);
    for (let i = 0; i < r.points.length - 1; i++) {
      const seg = new Segment();
      seg.set(r.points[i].x, r.points[i].y, r.points[i + 1].x, r.points[i + 1].y);
      seg.radius = phys.collisionRadius;
      seg.restitution = phys.restitution;
      seg.friction = phys.friction;
      seg.kick = phys.kick;
      seg.kickUp = phys.kickUp;
      seg.oneWayY = phys.oneWayY;
      seg.kind = r.kind === 'rail' ? 'wall' : r.kind;
      seg.active = true;
      world.addSegment(seg);
      chunk.segments.push(seg);
    }
  }
  for (const b of spec.bumpers) {
    const col = new CircleCollider().set(b.x, b.y, BUMPER_RADIUS);
    col.active = true;
    world.addBumper(col);
    chunk.bumpers.push(col);
  }
  for (const f of spec.flippers) {
    const left = new Flipper('left', f.centerX - f.gap * 0.5, f.y);
    const right = new Flipper('right', f.centerX + f.gap * 0.5, f.y);
    left.active = true;
    right.active = true;
    world.addFlipper(left);
    world.addFlipper(right);
    chunk.flippers.push(left, right);
  }

  // Budget audit against GameConfig.pools (streamer keeps ~5 boards live).
  const LIVE_BOARDS = 5;
  if (spec.rails.length * LIVE_BOARDS > Config.pools.rails)
    budgetFailures.push(`board ${index}: ${spec.rails.length} rails × ${LIVE_BOARDS} > pool ${Config.pools.rails}`);
  if (spec.dots.length * LIVE_BOARDS > Config.pools.dots)
    budgetFailures.push(`board ${index}: ${spec.dots.length} dots × ${LIVE_BOARDS} > pool ${Config.pools.dots}`);
  if (spec.bumpers.length * LIVE_BOARDS > Config.pools.bumpers)
    budgetFailures.push(`board ${index}: ${spec.bumpers.length} bumpers × ${LIVE_BOARDS} > pool ${Config.pools.bumpers}`);

  archetypesSeen.add(classifyArchetype(spec));
  live.set(index, chunk);
}

function recycle(index: number): void {
  const chunk = live.get(index);
  if (!chunk) return;
  for (const s of chunk.segments) world.removeSegment(s);
  for (const b of chunk.bumpers) world.removeBumper(b);
  for (const f of chunk.flippers) f.active = false;
  // PhysicsWorld keeps inactive flippers in its array; they're skipped.
  live.delete(index);
}

function stream(ballY: number): void {
  const current = Math.floor(ballY / H);
  for (let i = Math.max(0, current - 1); i <= current + Config.level.spawnAheadChunks; i++) {
    instantiate(i);
  }
  for (const idx of [...live.keys()]) {
    if (idx < current - 1) recycle(idx);
  }
}

// ----------------------------------------------------------------- bot --- //

const SPAWN = { x: 1.5, y: 8 };
const ball = world.ball;
ball.reset(SPAWN.x, SPAWN.y);
stream(SPAWN.y);

let launchArmed = true;
let captureTimer = 0;
let pressTimer = 0;
let pressedSide: 'left' | 'right' | null = null;
let flipCooldown = 0;
let launches = 0;
let flips = 0;
let containViolation: string | null = null;

function nearestFlipperPair(): Flipper[] {
  const idx = Math.floor(ball.position.y / H);
  return live.get(idx)?.flippers ?? [];
}

function setFlippers(side: 'left' | 'right' | null): void {
  for (const c of live.values()) {
    for (const f of c.flippers) {
      f.press(f.side === side);
    }
  }
}

function launch(): void {
  const side = ball.position.x < centreX(ball.position.y) ? 'right' : 'left';
  const sideX = side === 'left' ? Config.launch.aimX : -Config.launch.aimX;
  ball.velocity.set(sideX, Config.launch.plungeSpeed);
  ball.clampSpeed();
  world.resetNudge();
  launchArmed = false;
  captureTimer = 0;
  launches++;
}

let t = 0;
let maxY = SPAWN.y;
const archeLog: string[] = [];

while (t < TIME_BUDGET) {
  // --- bot control ------------------------------------------------------ //
  const localY = ball.position.y - Math.floor(ball.position.y / H) * H;
  const vy = ball.velocity.y;

  if (launchArmed) {
    launch();
  }

  // Re-arm plunger exactly like Game.updateLauncher.
  if (!launchArmed) {
    if (ball.velocity.length() < Config.launch.captureSpeed && localY < Config.launch.captureMaxLocalY) {
      captureTimer += DT;
      if (captureTimer >= Config.launch.captureDelay) launchArmed = true;
    } else {
      captureTimer = 0;
    }
  }

  // Flip when the ball drops into the flipper zone of its board.
  flipCooldown -= DT;
  if (pressedSide) {
    pressTimer -= DT;
    if (pressTimer <= 0) {
      pressedSide = null;
      setFlippers(null);
      flipCooldown = 0.25;
    }
  } else if (flipCooldown <= 0 && vy < -2 && localY < 11 && localY > 3.5) {
    const pair = nearestFlipperPair();
    if (pair.length) {
      const cx = (pair[0].pivot.x + pair[1].pivot.x) * 0.5;
      pressedSide = ball.position.x < cx ? 'left' : 'right';
      setFlippers(pressedSide);
      pressTimer = 0.3;
      flips++;
    }
  }

  // --- step ------------------------------------------------------------- //
  world.step(DT);
  t += DT;
  maxY = Math.max(maxY, ball.position.y);
  stream(ball.position.y);

  // --- containment audit ------------------------------------------------ //
  const dx = Math.abs(ball.position.x - centreX(ball.position.y));
  if (dx > HALF + 1.5 || ball.position.y < -5) {
    containViolation = `t=${t.toFixed(1)}s pos=(${ball.position.x.toFixed(2)}, ${ball.position.y.toFixed(2)}) dx=${dx.toFixed(2)}`;
    break;
  }

  if (maxY >= TARGET_Y && archetypesSeen.size >= 4) break;
}

// Force archetype coverage check across first 24 boards regardless of climb.
for (let i = 0; i < 24; i++) {
  const spec = generateChunk(i);
  const a = classifyArchetype(spec);
  archetypesSeen.add(a);
  if (i < 8) archeLog.push(`board ${i}: ${a} (rails=${spec.rails.length}, dots=${spec.dots.length}, bumpers=${spec.bumpers.length})`);
}

// ------------------------------------------------------------- report --- //

const climbed = maxY >= TARGET_Y;
const unknowns = [...archetypesSeen].filter((a) => a.startsWith('unknown'));
const variety = ['twinRamps', 'orbit', 'island', 'nest'].every((a) => archetypesSeen.has(a));

console.log('--- PinIn headless sim ---');
console.log(`sim time: ${t.toFixed(1)}s  launches: ${launches}  flips: ${flips}`);
console.log(`maxY: ${maxY.toFixed(1)} (target ${TARGET_Y})  → ${climbed ? 'PASS' : 'FAIL'}`);
console.log(`containment: ${containViolation ? `FAIL ${containViolation}` : 'PASS'}`);
console.log(`archetypes: ${[...archetypesSeen].join(', ')}  → ${variety && unknowns.length === 0 ? 'PASS' : 'FAIL'}`);
console.log(`pool budgets: ${budgetFailures.length === 0 ? 'PASS' : 'FAIL\n  ' + budgetFailures.join('\n  ')}`);
for (const line of archeLog) console.log('  ' + line);

const ok = climbed && !containViolation && variety && unknowns.length === 0 && budgetFailures.length === 0;
process.exit(ok ? 0 : 1);
