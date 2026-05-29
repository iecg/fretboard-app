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

  const newTime = time + jitterT * timeAmountSec;
  const newVelocity = Math.max(0, Math.min(1, velocity + jitterV * velocityAmount));

  return { time: newTime, velocity: newVelocity };
}
