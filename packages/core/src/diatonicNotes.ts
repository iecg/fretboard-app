import { getScaleNotes } from "./theory";

/**
 * Returns the set of in-key sharps-form note names for `scaleName` rooted at
 * `tonicNote`. The result is keyed by note name (no octave) and uses the
 * internal sharps-form convention (e.g. "A#" instead of "Bb").
 *
 * Used by the v2.0 DegreeGrid to decide whether a chromatic cell renders
 * as "in-key" (full prominence) or "borrowed" (muted numeral styling).
 */
export function getDiatonicNotes(
  scaleName: string,
  tonicNote: string,
): ReadonlySet<string> {
  const notes = getScaleNotes(tonicNote, scaleName);
  if (!notes || notes.length === 0) return new Set();
  return new Set(notes);
}
