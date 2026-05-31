import { CHORD_DEFINITIONS, NOTES } from "@fretflow/core";
import type { BassNoteRole } from "./audio/patterns";
import { getNearestInversion } from "./voiceLeading";
import { resolveBassNoteInRange } from "./bassLogic";

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
 * @example resolveChordVoicing("C", "M")
 *   → ["C3", "E3", "G3"]
 * @example resolveChordVoicing("A", "m7", 3)
 *   → ["A3", "C4", "E4", "G4"]
 */
export function resolveChordVoicing(
  root: string,
  quality: string,
  rootOctave: number = PROGRESSION_CHORD_ROOT_OCTAVE,
  prevNotes?: string[],
): string[] {
  const definition = CHORD_DEFINITIONS[quality];
  if (!definition) return [];
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];

  if (prevNotes && prevNotes.length > 0) {
    const baseNotes = definition.members.map(member => 
      NOTES[(((rootIndex + member.semitone) % 12) + 12) % 12]
    );
    return getNearestInversion(prevNotes, baseNotes, rootOctave);
  }

  return definition.members.map((member) => {
    const absolute = rootOctave * 12 + rootIndex + member.semitone;
    const note = NOTES[((absolute % 12) + 12) % 12];
    const octave = Math.floor(absolute / 12);
    return `${note}${octave}`;
  });
}

/**
 * Funk color tones to layer on top of a resolved voicing, as semitone offsets
 * above the chord root (computed at the chord's root octave, so +10/+14/+21
 * naturally land at/above the triad). Qualities not listed get no extensions
 * (dim/aug/sus/6 would clash). Used only on "stab" hits — see buildAllLayers.
 *   +10 = b7,  +14 = 9,  +21 = 13
 */
const FUNK_EXTENSION_SEMITONES: Record<string, readonly number[]> = {
  M: [10, 14], // -> dominant 9 (the James Brown "E9" sound)
  m: [10, 14], // -> m9
  m7: [14], // already has b7 -> m9
  "7": [14, 21], // -> 9 / 13
  maj7: [14], // -> maj9 (no b7; stays major)
};

/**
 * Layer idiomatic funk extensions onto a resolved chord voicing. Pure: returns
 * a new array, never mutates the input. Returns the input unchanged when the
 * quality has no funk extension, the root is unknown, or the voicing is empty.
 */
export function extendFunkVoicing(
  voicing: string[],
  root: string,
  quality: string,
): string[] {
  const offsets = FUNK_EXTENSION_SEMITONES[quality];
  if (!offsets || voicing.length === 0) return voicing;
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return voicing;

  const base = PROGRESSION_CHORD_ROOT_OCTAVE * 12 + rootIndex;
  const existing = new Set(voicing);
  const added: string[] = [];
  for (const semitone of offsets) {
    const absolute = base + semitone;
    const note = NOTES[((absolute % 12) + 12) % 12];
    const pitch = `${note}${Math.floor(absolute / 12)}`;
    if (!existing.has(pitch)) {
      existing.add(pitch);
      added.push(pitch);
    }
  }
  return [...voicing, ...added];
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
  prevBassNote?: string,
): string {
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return resolveBassNoteInRange(root, "E1", "E3", prevBassNote || `${root}${rootOctave}`);

  const definition = CHORD_DEFINITIONS[quality];
  const rootAbsolute = rootOctave * 12 + rootIndex;

  const toNoteName = (absolute: number) => NOTES[((absolute % 12) + 12) % 12];

  let targetNoteName = toNoteName(rootAbsolute);
  let isOctaveAbove = false;

  switch (role) {
    case "root":
      targetNoteName = toNoteName(rootAbsolute);
      break;
    case "third": {
      const third = definition?.members.find((m) => m.name === "3" || m.name === "b3");
      if (third) targetNoteName = toNoteName(rootAbsolute + third.semitone);
      break;
    }
    case "fifth": {
      const fifth = definition?.members.find((m) => m.name === "5" || m.name === "b5" || m.name === "#5");
      if (fifth) targetNoteName = toNoteName(rootAbsolute + fifth.semitone);
      break;
    }
    case "octave":
      targetNoteName = toNoteName(rootAbsolute);
      isOctaveAbove = true;
      break;
    case "flat-seventh": {
      // Prefer the chord's own 7th member (e.g. maj7 → +11); otherwise a
      // dominant b7 = root + 10 semitones (the funk default).
      const seventh = definition?.members.find((m) => m.name === "b7" || m.name === "7");
      targetNoteName = toNoteName(rootAbsolute + (seventh ? seventh.semitone : 10));
      break;
    }
    case "chromatic-approach": {
      if (nextChordRoot) {
        const nextIndex = NOTES.indexOf(nextChordRoot);
        if (nextIndex >= 0) {
          targetNoteName = toNoteName(rootOctave * 12 + nextIndex - 1);
        }
      } else {
        targetNoteName = toNoteName(rootAbsolute - 1);
      }
      break;
    }
  }

  // Use register-aware logic to pick the best octave within E1-E3
  const fallbackBassNote = prevBassNote || `${root}${rootOctave}`;
  const resolved = resolveBassNoteInRange(targetNoteName, "E1", "E3", fallbackBassNote);
  
  if (isOctaveAbove && role === "octave") {
    // If explicitly asked for an octave, we shift it up one from whatever the base logic decided
    // Bounded bump so it doesn't leave the E1-E3 range
    const noteName = resolved.replace(/[0-9]/g, "");
    const oct = parseInt(resolved.replace(/[^0-9]/g, ""), 10);
    const newOct = Math.min(oct + 1, 3); // upper bound E3
    return `${noteName}${newOct}`;
  }

  return resolved;
}

