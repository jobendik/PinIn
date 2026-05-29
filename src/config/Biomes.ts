/**
 * Biome / sector progression table.
 *
 * The vertical world is segmented into 1,000-distance "canyons", each with its
 * own neon palette, rank title, and escalating mechanical complexity. Beyond the
 * final sector the world enters Overtime: the canyons loop forever with all
 * dots, power-ups, and mini-games purged (blueprint §Progression Architecture).
 *
 * Names and palettes here are original to PinIn.
 */
export interface Biome {
  readonly id: string;
  readonly name: string;
  readonly rank: string;
  readonly minDistance: number;
  readonly maxDistance: number;
  /** Emissive accent for ramps / dots / ball, as a 0xRRGGBB hex. */
  readonly accent: number;
  /** Secondary accent used for alternating geometry and particles. */
  readonly accentB: number;
  /** Background fog / clear colour. */
  readonly background: number;
  /** Difficulty knobs consumed by the chunk generator. */
  readonly difficulty: {
    /** Horizontal narrowing factor for escape ramps (0 = wide, 1 = tight). */
    readonly tightness: number;
    /** Probability [0,1] a chunk spawns a power-up orb. */
    readonly powerupChance: number;
    /** Whether lateral out-of-bounds void gaps may appear. */
    readonly lateralVoids: boolean;
    /** Whether autonomous red "Ball Releaser" obstacles may appear. */
    readonly ballReleasers: boolean;
  };
}

export const BIOMES: readonly Biome[] = [
  {
    id: 'origin',
    name: 'Origin Canyon',
    rank: 'Rookie',
    minDistance: 0,
    maxDistance: 999,
    accent: 0x14e0ff,
    accentB: 0x2d9bff,
    background: 0x05010f,
    difficulty: { tightness: 0.0, powerupChance: 0.12, lateralVoids: false, ballReleasers: false },
  },
  {
    id: 'circuit',
    name: 'Circuit Canyon',
    rank: 'Omega Rider',
    minDistance: 1000,
    maxDistance: 1999,
    accent: 0x2dffd5,
    accentB: 0x14e0ff,
    background: 0x040a12,
    difficulty: { tightness: 0.15, powerupChance: 0.18, lateralVoids: false, ballReleasers: false },
  },
  {
    id: 'electric',
    name: 'Electric Canyon',
    rank: 'Electric Dreamer',
    minDistance: 2000,
    maxDistance: 2999,
    accent: 0x7cff3d,
    accentB: 0xeaff2d,
    background: 0x060c06,
    difficulty: { tightness: 0.3, powerupChance: 0.2, lateralVoids: false, ballReleasers: false },
  },
  {
    id: 'commander',
    name: 'Commander Canyon',
    rank: 'Laser Cruiser',
    minDistance: 3000,
    maxDistance: 3999,
    accent: 0xff8a2d,
    accentB: 0xffd23d,
    background: 0x100604,
    difficulty: { tightness: 0.4, powerupChance: 0.22, lateralVoids: true, ballReleasers: false },
  },
  {
    id: 'grid',
    name: 'Grid Canyon',
    rank: 'Grid Commander',
    minDistance: 4000,
    maxDistance: 4999,
    accent: 0x9b5cff,
    accentB: 0x5c8aff,
    background: 0x09061a,
    difficulty: { tightness: 0.5, powerupChance: 0.24, lateralVoids: true, ballReleasers: false },
  },
  {
    id: 'voidspace',
    name: 'Void Canyon',
    rank: 'Cyber Ninja',
    minDistance: 5000,
    maxDistance: 5999,
    accent: 0xff2d95,
    accentB: 0xff5cc8,
    background: 0x12031a,
    difficulty: { tightness: 0.6, powerupChance: 0.26, lateralVoids: true, ballReleasers: false },
  },
  {
    id: 'neon-isles',
    name: 'Neon Isles',
    rank: 'Neon Defender',
    minDistance: 6000,
    maxDistance: 6999,
    accent: 0xff3d6e,
    accentB: 0xffaa2d,
    background: 0x14040a,
    difficulty: { tightness: 0.68, powerupChance: 0.26, lateralVoids: true, ballReleasers: true },
  },
  {
    id: 'midnight',
    name: 'Midnight Mountains',
    rank: 'Midnight Legend',
    minDistance: 7000,
    maxDistance: 7999,
    accent: 0x3d6eff,
    accentB: 0x9b5cff,
    background: 0x02030a,
    difficulty: { tightness: 0.78, powerupChance: 0.22, lateralVoids: true, ballReleasers: true },
  },
] as const;

/** Ranks earned deep into the endless Overtime loop. */
const OVERTIME_RANKS: readonly { from: number; rank: string }[] = [
  { from: 8000, rank: 'Overtime' },
  { from: 9000, rank: 'Space Chaser' },
  { from: 10000, rank: 'Electromancer' },
  { from: 11000, rank: 'Prodigy' },
  { from: 16000, rank: 'Double Rainbow' },
];

/** The synthetic biome used once the player passes into Overtime. */
export const OVERTIME_BIOME: Biome = {
  id: 'overtime',
  name: 'Overtime',
  rank: 'Overtime',
  minDistance: 8000,
  maxDistance: Number.POSITIVE_INFINITY,
  accent: 0x6a7a8a, // desaturated — signals the absence of time-restoring elements
  accentB: 0x4a5a6a,
  background: 0x04060a,
  difficulty: { tightness: 0.7, powerupChance: 0, lateralVoids: true, ballReleasers: true },
};

export function isOvertime(distance: number): boolean {
  return distance >= OVERTIME_BIOME.minDistance;
}

/** Resolve the active biome for a given distance, looping palettes in Overtime. */
export function biomeForDistance(distance: number): Biome {
  if (isOvertime(distance)) {
    // Loop the original palettes but desaturate toward the Overtime tone.
    return OVERTIME_BIOME;
  }
  for (const biome of BIOMES) {
    if (distance >= biome.minDistance && distance <= biome.maxDistance) {
      return biome;
    }
  }
  return BIOMES[BIOMES.length - 1];
}

/** Resolve the player's rank title for a given distance. */
export function rankForDistance(distance: number): string {
  if (isOvertime(distance)) {
    let rank = OVERTIME_RANKS[0].rank;
    for (const tier of OVERTIME_RANKS) {
      if (distance >= tier.from) rank = tier.rank;
    }
    return rank;
  }
  return biomeForDistance(distance).rank;
}
