import type { Voicing } from "./voicings";

/** Standard 25.5" scale length in millimetres. */
const SCALE_LENGTH_MM = 25.5 * 25.4;

/**
 * Distance from the nut to fret `n`, in millimetres, using the equal-tempered
 * fret-spacing formula (12th root of 2).
 *
 * fret_pos(n) = L − L / (2 ^ (n / 12))
 *
 * Fret 0 is at the nut (0 mm). Fret 12 is at half the scale length.
 */
export function fretPositionMm(fret: number): number {
  return SCALE_LENGTH_MM - SCALE_LENGTH_MM / Math.pow(2, fret / 12);
}

/**
 * The physical width a voicing occupies, in millimetres. Measured between the
 * lowest fretted-note position (− 1 fret to include the player's first finger
 * room) and the highest fretted-note position. Open strings (fret 0) are
 * excluded — they impose no stretch.
 *
 * Returns 0 when fewer than 2 fretted notes are present (no meaningful span).
 */
export function voicingWidthMm(voicing: Voicing): number {
  const fretted = voicing.notes
    .map((n) => n.fretIndex)
    .filter((f) => f > 0);
  if (fretted.length < 2) return 0;
  const min = Math.min(...fretted);
  const max = Math.max(...fretted);
  // Anchor the span between the position of fret (min − 1) and fret max:
  // that's the gap between the player's index and pinky.
  return fretPositionMm(max) - fretPositionMm(Math.max(0, min - 1));
}

export type HandSize = "small" | "medium" | "large";

/**
 * Span thresholds. Values are starting points from anthropometric data on adult
 * index-to-pinky maximum span; tune after live trial.
 */
export const HAND_SPAN_THRESHOLDS_MM: Record<HandSize, number> = {
  small: 130,
  medium: 150,
  large: 170,
};

export function filterByHandSpan(
  voicings: readonly Voicing[],
  handSize: HandSize,
): Voicing[] {
  const threshold = HAND_SPAN_THRESHOLDS_MM[handSize];
  return voicings.filter((v) => voicingWidthMm(v) <= threshold);
}
