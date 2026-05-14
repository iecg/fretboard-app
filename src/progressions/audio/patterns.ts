/**
 * Beat-level patterns for the progression backing track.
 *
 * Every pattern is expressed in **beat fractions** within a bar (0 inclusive,
 * `beatsPerBar` exclusive), letting the scheduler scale a pattern to any
 * meter and tempo without owning timing math.
 *
 * Patterns are intentionally small and audition-friendly: a default rock
 * strum, a default rock drum beat, a four-on-the-floor metronome. They
 * compose at the scheduler layer rather than being a single monolithic
 * "groove" object.
 */

export type StrumDirection = "down" | "up";

export interface StrumHit {
  /** Beat offset from the bar start (e.g. 0, 0.5, 1, 1.5, ...). */
  beat: number;
  /** Loudness scalar 0..1. Emphasizes downbeats. */
  velocity: number;
  /** Determines voicing order; up-strokes are reversed. */
  direction: StrumDirection;
}

export interface DrumHit {
  beat: number;
  velocity: number;
}

export interface DrumPattern {
  kicks: readonly DrumHit[];
  snares: readonly DrumHit[];
  hats: readonly DrumHit[];
  openHats?: readonly DrumHit[];
}

/**
 * Eighth-note pop strum: D _ D U _ U D U.
 * Beats are emphasised; off-beats use a lighter velocity.
 * Designed for 4/4; the scheduler will skip hits past `beatsPerBar`.
 */
export const POP_STRUM_PATTERN: readonly StrumHit[] = [
  { beat: 0, velocity: 0.95, direction: "down" },
  { beat: 1, velocity: 0.6, direction: "down" },
  { beat: 1.5, velocity: 0.55, direction: "up" },
  { beat: 2.5, velocity: 0.55, direction: "up" },
  { beat: 3, velocity: 0.7, direction: "down" },
  { beat: 3.5, velocity: 0.5, direction: "up" },
];

/**
 * Steady rock beat for 4/4: kick on 1 and 3, snare on 2 and 4, eighth-note
 * closed hats throughout. The scheduler clips hits past `beatsPerBar`, so
 * 3/4 reads as the first three beats of the same groove.
 */
export const ROCK_DRUM_PATTERN: DrumPattern = {
  kicks: [
    { beat: 0, velocity: 1 },
    { beat: 2, velocity: 0.9 },
  ],
  snares: [
    { beat: 1, velocity: 1 },
    { beat: 3, velocity: 1 },
  ],
  hats: [
    { beat: 0, velocity: 0.55 },
    { beat: 0.5, velocity: 0.4 },
    { beat: 1, velocity: 0.55 },
    { beat: 1.5, velocity: 0.4 },
    { beat: 2, velocity: 0.55 },
    { beat: 2.5, velocity: 0.4 },
    { beat: 3, velocity: 0.55 },
    { beat: 3.5, velocity: 0.4 },
  ],
};

/**
 * Generate metronome click events: one click per beat, with an accent on
 * beat 1. Returned dynamically because beat count depends on meter.
 */
export function buildMetronomePattern(beatsPerBar: number): readonly DrumHit[] {
  const out: DrumHit[] = [];
  for (let beat = 0; beat < beatsPerBar; beat++) {
    out.push({ beat, velocity: beat === 0 ? 0.8 : 0.5 });
  }
  return out;
}

/**
 * Filter a pattern's events to those that fall inside the requested window
 * of beats (relative to the step start). Used when a step spans a partial
 * bar — e.g. a half-bar chord change shouldn't trigger the full bar's beat 3
 * kick on its own audio segment.
 */
export function clipPatternToBeats<T extends { beat: number }>(
  pattern: readonly T[],
  beatsAvailable: number,
): T[] {
  if (beatsAvailable <= 0) return [];
  return pattern.filter((hit) => hit.beat < beatsAvailable);
}
