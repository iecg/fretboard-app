/**
 * Swing time-shift utility. Delays off-beats (beat positions with a 0.5
 * fractional part) forward in time to produce a swung feel.
 *
 * `swing` is a ratio in [0, 1] that controls how far off-beats are pushed.
 * A value of 0 means straight (no swing); higher values push the off-beat
 * closer to the following downbeat. The actual delay added is:
 *
 *   shift = swing * (1/3) * secondsPerBeat
 *
 * This maps swing=1 to a full triplet feel (off-beat lands on the 2nd triplet
 * of the beat division).
 */

const OFF_BEAT_TOLERANCE = 0.01;

function isOffBeat(beat: number): boolean {
  const fractional = beat % 1;
  return Math.abs(fractional - 0.5) < OFF_BEAT_TOLERANCE;
}

/**
 * Apply swing to a beat position.
 *
 * @param beat - Beat position (e.g. 0, 0.5, 1, 1.5, …).
 * @param swing - Swing amount in [0, 1]. 0 = straight, higher = more swing.
 * @param secondsPerBeat - Duration of one beat in seconds, used to scale the shift.
 * @returns The adjusted beat position in seconds (or the same beat if on-beat).
 */
export function applySwing(beat: number, swing: number, secondsPerBeat: number): number {
  if (swing <= 0 || !isOffBeat(beat)) return beat;
  return beat + swing * (1 / 3) * secondsPerBeat;
}
