export interface JitterParams {
  time: number;
  velocity: number;
  seed: number;
  timeAmountSec?: number;
  velocityAmount?: number;
}

/**
 * A simple seeded pseudo-random number generator (Mulberry32).
 * Returns a float between 0 and 1.
 */
function seededRandom(seed: number): number {
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Applies deterministic jitter to timing and velocity to humanize playback.
 */
export function applyJitter({
  time,
  velocity,
  seed,
  timeAmountSec = 0.015,
  velocityAmount = 0.1,
}: JitterParams): { time: number; velocity: number } {
  // We use two different derivations of the seed so time and velocity jitter differently
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 12345);

  // Map [0, 1] to [-1, 1]
  const jitterT = (r1 * 2) - 1;
  const jitterV = (r2 * 2) - 1;

  const newTime = Math.max(0, time + jitterT * timeAmountSec);
  const newVelocity = Math.max(0, Math.min(1, velocity + jitterV * velocityAmount));

  return { time: newTime, velocity: newVelocity };
}

/** Threshold below which a hit is a droppable "ghost". */
const GHOST_VELOCITY_THRESHOLD = 0.4;
/** Drop probability applied to sub-threshold ghosts. */
const GHOST_DROP_CHANCE = 0.12;
/** Seed offset so the drop roll is independent of the time/velocity rolls. */
const DROP_SEED_OFFSET = 54321;

/**
 * Deterministic, seeded decision: should this hit be dropped entirely to
 * simulate a player occasionally skipping a ghost stroke? Uses the hit's
 * *authored* (pre-jitter) velocity so a ±10% velocity jitter can never flip a
 * borderline ghost across the threshold. Structural hits (>= 0.4) never drop.
 */
export function shouldDropHit(velocity: number, seed: number): boolean {
  if (velocity >= GHOST_VELOCITY_THRESHOLD) return false;
  return seededRandom(seed + DROP_SEED_OFFSET) < GHOST_DROP_CHANCE;
}
