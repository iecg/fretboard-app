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

function parallelRoots(parentScale: string, tonic: string): string[] {
  const which = parallelKeyFor(parentScale);
  const out: string[] = [];
  const collect = (chordNames: readonly string[] = []) => {
    for (const name of chordNames) {
      const t = Chord.get(name).tonic;
      if (t) out.push(t);
    }
  };
  if (which === "major" || which === "both") {
    collect(Key.majorKey(tonic).triads);
  }
  if (which === "minor" || which === "both") {
    const mk = Key.minorKey(tonic);
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

  const borrowedOffsets = new Set<number>();
  for (const root of parallelRoots(parent, tonicNote)) {
    const off = chromaOffset(root, tonicChroma);
    if (off != null && !diatonicQualityByOffset.has(off)) {
      borrowedOffsets.add(off);
    }
  }

  return Array.from({ length: 12 }, (_, offset): ScaleRootInfo => {
    const note = NOTES[(tonicChroma + offset) % 12];
    if (diatonicQualityByOffset.has(offset)) {
      return { note, offset, rootClass: "diatonic", defaultQuality: diatonicQualityByOffset.get(offset)! };
    }
    if (borrowedOffsets.has(offset)) {
      return { note, offset, rootClass: "borrowed", defaultQuality: null };
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
