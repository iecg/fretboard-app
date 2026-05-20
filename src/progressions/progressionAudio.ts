import { CHORD_DEFINITIONS, NOTES } from "@fretflow/core";
import type { BassNoteRole } from "./audio/patterns";

/**
 * Reasonable default octave for the root note of a strummed chord. Chosen
 * so that triad voicings sit around the middle of a guitar's range without
 * dipping into mud (G3-B3-D4 etc.) or shrieking in the high octaves.
 */
const PROGRESSION_CHORD_ROOT_OCTAVE = 3;
const PROGRESSION_BASS_ROOT_OCTAVE = 2;

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

export function resolveBassLineNotes(
  root: string,
  quality: string,
  rootOctave: number = PROGRESSION_BASS_ROOT_OCTAVE,
): string[] {
  const definition = CHORD_DEFINITIONS[quality];
  if (!definition) return [];
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];

  const fifth = definition.members.find((member) =>
    member.name === "5" || member.name === "b5" || member.name === "#5"
  );
  const semitones = fifth ? [0, fifth.semitone] : [0];

  return semitones.map((semitone) => {
    const absolute = rootOctave * 12 + rootIndex + semitone;
    const note = NOTES[((absolute % 12) + 12) % 12];
    const octave = Math.floor(absolute / 12);
    return `${note}${octave}`;
  });
}

export function resolveBassNoteForRole(
  root: string,
  quality: string,
  role: BassNoteRole,
  nextChordRoot?: string,
  rootOctave: number = PROGRESSION_BASS_ROOT_OCTAVE,
): string {
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return `${root}${rootOctave}`;

  const definition = CHORD_DEFINITIONS[quality];
  const rootAbsolute = rootOctave * 12 + rootIndex;

  const toNote = (absolute: number) => {
    const note = NOTES[((absolute % 12) + 12) % 12];
    const oct = Math.floor(absolute / 12);
    return `${note}${oct}`;
  };

  switch (role) {
    case "root":
      return toNote(rootAbsolute);
    case "third": {
      const third = definition?.members.find((m) => m.name === "3" || m.name === "b3");
      return third ? toNote(rootAbsolute + third.semitone) : toNote(rootAbsolute);
    }
    case "fifth": {
      const fifth = definition?.members.find((m) => m.name === "5" || m.name === "b5" || m.name === "#5");
      return fifth ? toNote(rootAbsolute + fifth.semitone) : toNote(rootAbsolute);
    }
    case "octave":
      return toNote(rootAbsolute + 12);
    case "chromatic-approach": {
      if (nextChordRoot) {
        const nextIndex = NOTES.indexOf(nextChordRoot);
        if (nextIndex >= 0) {
          const nextAbsolute = rootOctave * 12 + nextIndex;
          return toNote(nextAbsolute - 1);
        }
      }
      return toNote(rootAbsolute - 1);
    }
    default:
      return toNote(rootAbsolute);
  }
}

