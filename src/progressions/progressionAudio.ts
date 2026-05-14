import { CHORD_DEFINITIONS, NOTES } from "@fretflow/core";

/**
 * Reasonable default octave for the root note of a strummed chord. Chosen
 * so that triad voicings sit around the middle of a guitar's range without
 * dipping into mud (G3-B3-D4 etc.) or shrieking in the high octaves.
 */
export const PROGRESSION_CHORD_ROOT_OCTAVE = 3;

/**
 * Default strum lag between consecutive note onsets, in milliseconds.
 * Mimics a downstroke across strings; tight enough to land within a single
 * beat even at fast tempos.
 */
export const PROGRESSION_STRUM_DELAY_MS = 25;

/**
 * Compute the note name (without octave) at `semitone` half-steps above
 * `root`. Wraps the chromatic scale; returns `null` if the root is not in
 * the recognised note list.
 */
function noteAtOffset(root: string, semitone: number): string | null {
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return null;
  const offset = ((rootIndex + semitone) % 12 + 12) % 12;
  return NOTES[offset];
}

/**
 * Resolve the absolute pitched notes (note name + octave) for a chord given
 * its root note and quality. The root is placed at `rootOctave`; each
 * subsequent interval is octave-shifted upward so the chord stacks
 * monotonically rather than crossing back below the root.
 *
 * Returns an empty array when the quality is unknown or the root is not a
 * recognised note. Callers should treat empty as "no audible chord" and
 * skip playback rather than attempt a partial voicing.
 *
 * @example resolveChordVoicing("C", "Major Triad")
 *   → ["C3", "E3", "G3"]
 * @example resolveChordVoicing("A", "Minor 7th", 3)
 *   → ["A3", "C4", "E4", "G4"]
 */
export function resolveChordVoicing(
  root: string,
  quality: string,
  rootOctave: number = PROGRESSION_CHORD_ROOT_OCTAVE,
): string[] {
  const definition = CHORD_DEFINITIONS[quality];
  if (!definition) return [];
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];

  return definition.members.map((member) => {
    // Absolute distance from C0 in semitones, then split back into
    // note-name + octave so each chord tone sits above the previous root.
    const absolute = rootOctave * 12 + rootIndex + member.semitone;
    const note = NOTES[((absolute % 12) + 12) % 12];
    const octave = Math.floor(absolute / 12);
    return `${note}${octave}`;
  });
}

/** Exported for tests that want to spot-check the chromatic wrap. */
export const _internals = { noteAtOffset };
