import * as Key from "@tonaljs/key";
import * as Mode from "@tonaljs/mode";
import * as Chord from "@tonaljs/chord";
import * as Note from "@tonaljs/note";
import { NOTES } from "./theory";
import { getDegreeSequence } from "./degrees";
import { getDiatonicChord } from "./theory";

/** Pentatonic/blues scales borrow their harmonic context from a parent scale. */
export const HARMONY_PARENT_SCALE: Record<string, string> = {
  "major pentatonic": "major",
  "major blues": "major",
  "minor pentatonic": "minor",
  "minor blues": "minor",
};

export function getHarmonyParentScale(scaleName: string): string {
  return HARMONY_PARENT_SCALE[scaleName] ?? scaleName;
}

export type RootClass = "diatonic" | "borrowed" | "chromatic";

export interface ScaleRootInfo {
  /** Sharps-form note name (FretFlow contract). */
  note: string;
  /** Semitone distance from the tonic, 0-11. */
  offset: number;
  rootClass: RootClass;
  /** FretFlow quality key for diatonic roots; null otherwise. */
  defaultQuality: string | null;
}

/** Which parallel key the scale borrows from: "minor" for major-flavored
 *  scales, "major" for minor-flavored, "both" for diminished-flavored.
 *  Note: Tonal's `Mode.get(name).triad` returns "" for a major triad (not
 *  "M"), "m" for minor, and "dim" for diminished. */
function parallelKeyFor(scaleName: string): "minor" | "major" | "both" {
  if (scaleName === "major" || scaleName === "ionian") return "minor";
  if (
    scaleName === "minor" ||
    scaleName === "aeolian" ||
    scaleName === "harmonic minor" ||
    scaleName === "melodic minor"
  ) {
    return "major";
  }
  const mode = Mode.get(scaleName);
  if (!mode.empty) {
    if (mode.triad === "" || mode.triad === "M") return "minor"; // major-flavored → borrow from parallel minor
    if (mode.triad === "m") return "major"; // minor-flavored → borrow from parallel major
    return "both"; // diminished-flavored (e.g. locrian)
  }
  return "minor";
}

function chromaOffset(note: string, tonicChroma: number): number | null {
  const c = Note.chroma(note);
  if (c == null) return null;
  return ((c - tonicChroma) % 12 + 12) % 12;
}

/** Maps Tonal's chord-quality words to FretFlow's compact quality keys. */
function tonalQualityToKey(quality: string): string {
  switch (quality) {
    case "Major": return "M";
    case "Minor": return "m";
    case "Diminished": return "dim";
    case "Augmented": return "aug";
    default: return "M";
  }
}

interface ParallelRoot {
  tonic: string;
  /** FretFlow quality key (M / m / dim / aug) of the parallel-key triad. */
  quality: string;
}

function parallelRoots(parentScale: string, tonic: string): ParallelRoot[] {
  const which = parallelKeyFor(parentScale);
  const out: ParallelRoot[] = [];
  const collect = (chordNames: readonly string[] = []) => {
    for (const name of chordNames) {
      const chord = Chord.get(name);
      if (chord.tonic) out.push({ tonic: chord.tonic, quality: tonalQualityToKey(chord.quality) });
    }
  };
  if (which === "major" || which === "both") {
    collect(Key.majorKey(tonic).triads);
  }
  if (which === "minor" || which === "both") {
    const mk = Key.minorKey(tonic);
    // Natural first so its triad qualities win for offsets the harmonic minor
    // also covers (e.g. the natural ♭III major over the harmonic ♭III aug).
    collect(mk.natural?.triads);
    collect(mk.harmonic?.triads);
  }
  return out;
}

export function getScaleRoots(scaleName: string, tonicNote: string): ScaleRootInfo[] {
  const parent = getHarmonyParentScale(scaleName);
  const rawChroma = Note.chroma(tonicNote);
  const tonicChroma = rawChroma == null || Number.isNaN(rawChroma) ? 0 : rawChroma;

  const diatonicQualityByOffset = new Map<number, string>();
  for (const degree of getDegreeSequence(parent)) {
    const chord = getDiatonicChord(degree, parent, tonicNote);
    if (!chord) continue;
    const off = chromaOffset(chord.root, tonicChroma);
    if (off != null && !diatonicQualityByOffset.has(off)) {
      diatonicQualityByOffset.set(off, chord.quality);
    }
  }

  const borrowedQualityByOffset = new Map<number, string>();
  for (const { tonic, quality } of parallelRoots(parent, tonicNote)) {
    const off = chromaOffset(tonic, tonicChroma);
    if (off != null && !diatonicQualityByOffset.has(off) && !borrowedQualityByOffset.has(off)) {
      borrowedQualityByOffset.set(off, quality);
    }
  }

  return Array.from({ length: 12 }, (_, offset): ScaleRootInfo => {
    const note = NOTES[(tonicChroma + offset) % 12];
    if (diatonicQualityByOffset.has(offset)) {
      return { note, offset, rootClass: "diatonic", defaultQuality: diatonicQualityByOffset.get(offset)! };
    }
    if (borrowedQualityByOffset.has(offset)) {
      // Borrowed roots carry the parallel-key triad quality so the editor can
      // both label them correctly (Roman-numeral case) and default the created
      // chord to the musically-expected quality.
      return { note, offset, rootClass: "borrowed", defaultQuality: borrowedQualityByOffset.get(offset)! };
    }
    return { note, offset, rootClass: "chromatic", defaultQuality: null };
  });
}

/** Conventional harmonic-move names, keyed by quality-neutral chromatic numeral.
 *  Used to annotate borrowed-group options. Scale-agnostic; returns null for
 *  numerals without an established colloquial name. */
const HARMONIC_MOVES: Record<string, string> = {
  "bII": "Neapolitan",
  "bIII": "Mediant lift",
  "bVI": "Aeolian cadence",
  "bVII": "Modal cadence",
};

export function getHarmonicMoveAnnotation(plainNumeral: string): string | null {
  return HARMONIC_MOVES[plainNumeral] ?? null;
}

// Case-neutral (uppercase) Roman base per chromatic offset from the tonic.
// Natural tones share one numeral regardless of accidental preference;
// altered tones are spelled with a flat or a sharp accidental.
const ROMAN_NATURAL_BY_OFFSET: Record<number, string> = {
  0: "I", 2: "II", 4: "III", 5: "IV", 7: "V", 9: "VI", 11: "VII",
};
const ROMAN_FLAT_BY_OFFSET: Record<number, string> = {
  1: "♭II", 3: "♭III", 6: "♭V", 8: "♭VI", 10: "♭VII",
};
const ROMAN_SHARP_BY_OFFSET: Record<number, string> = {
  1: "♯I", 3: "♯II", 6: "♯IV", 8: "♯V", 10: "♯VI",
};

/**
 * Canonical Roman-numeral label for a chromatic offset (0–11) from the tonic,
 * with case + figured suffix reflecting the chord quality — uppercase for
 * major/augmented, lowercase for minor/diminished, `°` for diminished and `+`
 * for augmented. Used for both borrowed/chromatic dropdown options *and* the
 * cached step degree shown in the progression nav, title, and fretboard, so a
 * single source keeps every surface in sync.
 *
 * `quality` is a FretFlow quality key (M / m / dim / aug); unknown values are
 * treated as major.
 */
export function formatChromaticNumeral(
  offset: number,
  quality: string,
  preferFlats: boolean,
): string {
  const base =
    ROMAN_NATURAL_BY_OFFSET[offset] ??
    (preferFlats ? ROMAN_FLAT_BY_OFFSET : ROMAN_SHARP_BY_OFFSET)[offset] ??
    "";
  if (!base) return "";
  switch (quality) {
    case "m":
      return base.toLowerCase();
    case "dim":
      return `${base.toLowerCase()}°`;
    case "aug":
      return `${base}+`;
    default:
      return base;
  }
}
