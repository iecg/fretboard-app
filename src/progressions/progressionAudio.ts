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
 * Build a compact, rootless funk colour voicing for a chord. Pure.
 *
 * The grip is realised as an OPEN, ascending voicing: each colour tone is an
 * absolute pitch (root octave + offset), so the 9th (+14) genuinely rings an
 * octave ABOVE the 3rd rather than crunched next to it. This is deliberate — a
 * close-packing voice-lead (getNearestInversion) wrapped the 9th down into a
 * low major-2nd/semitone cluster against the 3rd (~150-195Hz), which is what
 * made the colour stabs sound muddy. Open spacing keeps every adjacent interval
 * >= a minor third while staying in the comp's octave-3/4 register, so it reads
 * clean without a register jump. Falls back to the plain voice-led triad when the
 * quality has no defined grip (dim/aug/sus/6). Returns [] for an unknown root.
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
  const base = PROGRESSION_CHORD_ROOT_OCTAVE * 12 + rootIndex;
  return offsets.map((o) => {
    const absolute = base + o;
    const note = NOTES[((absolute % 12) + 12) % 12];
    return `${note}${Math.floor(absolute / 12)}`;
  });
}

/**
 * Rootless Type-B (7-9-3-5) jazz comp tones per chord quality, as semitone
 * offsets above the chord root. The root is omitted — the piano LH and upright
 * bass cover it. 7th is the lowest tone, so the shape sits low for its register.
 *   +3 = b3, +4 = 3, +10 = b7, +11 = maj7, +14 = 9, +15 = b3+8ve, +16 = 3+8ve, +19 = 5+8ve
 */
const BOSSA_COLOR_TONES: Record<string, readonly number[]> = {
  maj7: [11, 14, 16, 19], // 7 / 9 / 3 / 5 — maj9
  M: [11, 14, 16, 19], // plain major voiced as maj9
  m7: [10, 14, 15, 19], // b7 / 9 / b3 / 5 — m9
  m: [10, 14, 15, 19], // m9
  "7": [10, 14, 16, 19], // b7 / 9 / 3 / 5 — dom9
};

/** Comp voicing base octave (the 7th, the lowest tone, starts here). */
const BOSSA_COMP_ROOT_OCTAVE = 3;
/** Register ceiling — the voicing's top note must not exceed C5 (absolute 60,
 *  i.e. octave*12 + pitchIndex). Higher-rooted voicings are dropped an octave
 *  at a time until they fit, keeping the comp in the C3–C5 register. */
const BOSSA_COMP_TOP_CEILING = 60;

/**
 * Build a rootless Type-B (7-9-3-5) jazz comp voicing for a chord, normalized
 * into the C3–C5 register. Pure. Builds the four colour tones at octave 3, then
 * transposes the whole voicing down by octaves until its top note is ≤ C5 —
 * so even high-rooted chords (A/B) stay in the comp register rather than
 * floating into octave 5. Falls back to the plain voice-led triad when the
 * quality has no defined grip (dim/aug/sus/6). Returns [] for an unknown root.
 */
export function buildBossaColorVoicing(
  root: string,
  quality: string,
  prevVoicing?: string[],
): string[] {
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];
  const offsets = BOSSA_COLOR_TONES[quality];
  if (!offsets) {
    return resolveChordVoicing(root, quality, undefined, prevVoicing);
  }
  const base = BOSSA_COMP_ROOT_OCTAVE * 12 + rootIndex;
  let absolutes = offsets.map((o) => base + o);
  while (Math.max(...absolutes) > BOSSA_COMP_TOP_CEILING) {
    absolutes = absolutes.map((a) => a - 12);
  }
  return absolutes.map((a) => {
    const note = NOTES[((a % 12) + 12) % 12];
    return `${note}${Math.floor(a / 12)}`;
  });
}

/**
 * Build a *rooted* bossa comp voicing: the rootless Type-B grip from
 * `buildBossaColorVoicing` with the chord root added as the lowest note (placed
 * an octave below the grip's bottom tone). Lets the piano carry its own bass
 * note on the off-beat chord stabs — so it no longer doubles the upright
 * bassline on beats 1 and 3. Pure. Returns the plain grip when it is empty or
 * the root is unknown.
 */
export function buildBossaRootedVoicing(
  root: string,
  quality: string,
  prevVoicing?: string[],
): string[] {
  const upper = buildBossaColorVoicing(root, quality, prevVoicing);
  const rootIndex = NOTES.indexOf(root);
  if (upper.length === 0 || rootIndex < 0) return upper;
  const lowestAbsolute = Math.min(
    ...upper.map((n) => {
      const m = /^([A-G]#?)(-?\d+)$/.exec(n)!;
      return parseInt(m[2], 10) * 12 + NOTES.indexOf(m[1]);
    }),
  );
  // Place the root pitch class at the highest octave strictly below the grip.
  let rootAbsolute = Math.floor(lowestAbsolute / 12) * 12 + rootIndex;
  if (rootAbsolute >= lowestAbsolute) rootAbsolute -= 12;
  const rootNote = `${NOTES[((rootAbsolute % 12) + 12) % 12]}${Math.floor(rootAbsolute / 12)}`;
  return [rootNote, ...upper];
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

