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
 * Rootless funk "color grip" tones per chord quality, as semitone offsets above
 * the chord root. Compact guide-tone + color shapes — the root (offset 0) is
 * intentionally omitted because the funk bass covers it (no low-register mud).
 * Major deliberately uses 6/9 (no b7) so a tonic chord is coloured without being
 * turned into a clashing dominant. Qualities not listed get the plain triad.
 *   +3 = b3,  +4 = 3,  +9 = 6,  +10 = b7,  +11 = maj7,  +14 = 9
 */
const FUNK_COLOR_TONES: Record<string, readonly number[]> = {
  "7": [4, 10, 14], // dominant: 3 / b7 / 9 — the classic "E9" grip
  M: [4, 9, 14], // major: 3 / 6 / 9 — 6-9 colour, NO b7 (would clash on a tonic)
  m: [3, 10, 14], // minor: b3 / b7 / 9 — m9
  m7: [3, 10, 14], // m7: b3 / b7 / 9 — m9
  maj7: [4, 11, 14], // maj7: 3 / 7 / 9 — maj9
};

/**
 * Build a compact, rootless, voice-led funk colour voicing for a chord. Pure.
 * Maps the quality's colour tones to note names and realises them voice-led near
 * `prevVoicing` (via getNearestInversion) so the grip lands in the same register
 * as the surrounding comp — no register jump. Falls back to the plain voice-led
 * triad when the quality has no defined grip (dim/aug/sus/6). Returns [] for an
 * unknown root.
 */
export function buildFunkColorVoicing(
  root: string,
  quality: string,
  prevVoicing?: string[],
): string[] {
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];
  const offsets = FUNK_COLOR_TONES[quality];
  if (!offsets) {
    return resolveChordVoicing(root, quality, undefined, prevVoicing);
  }
  const noteNames = offsets.map((o) => NOTES[(((rootIndex + o) % 12) + 12) % 12]);
  return getNearestInversion(prevVoicing ?? [], noteNames, PROGRESSION_CHORD_ROOT_OCTAVE);
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

