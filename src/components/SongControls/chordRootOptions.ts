import {
  getScaleRoots,
  getHarmonyParentScale,
  getHarmonicMoveAnnotation,
  getDegreesForScale,
  getNoteDisplayInScale,
  formatAccidental,
  SCALES,
  NOTES,
} from "@fretflow/core";
import type { LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { guessQualityForBorrowedRoot } from "../../progressions/progressionDomain";

const QUALITY_HINT: Record<string, string> = { M: "maj", m: "min", dim: "dim", aug: "aug" };

// Natural-tone scale-degree numerals (same regardless of accidental preference).
const NATURAL_NUMERAL_BY_OFFSET: Record<number, string> = {
  2: "ii", 4: "iii", 5: "iv", 7: "v", 9: "vi", 11: "vii",
};
// Altered-tone numerals — flat vs sharp spelling.
const FLAT_ALT_BY_OFFSET: Record<number, string> = {
  1: "♭ii", 3: "♭iii", 6: "♭v", 8: "♭vi", 10: "♭vii",
};
const SHARP_ALT_BY_OFFSET: Record<number, string> = {
  1: "♯i", 3: "♯ii", 6: "♯iv", 8: "♯v", 10: "♯vi",
};
function nonDiatonicNumeral(offset: number, preferFlats: boolean): string {
  if (offset in NATURAL_NUMERAL_BY_OFFSET) return NATURAL_NUMERAL_BY_OFFSET[offset];
  return (preferFlats ? FLAT_ALT_BY_OFFSET : SHARP_ALT_BY_OFFSET)[offset] ?? "";
}
// Plain ASCII numerals for annotation lookup + cached degree. Covers all non-tonic offsets.
const PLAIN_NUMERAL_BY_OFFSET: Record<number, string> = {
  1: "bII", 2: "II", 3: "bIII", 4: "III", 5: "IV", 6: "bV",
  7: "V", 8: "bVI", 9: "VI", 10: "bVII", 11: "VII",
};

export function buildChordRootGroups(
  scaleName: string,
  tonicNote: string,
  preferFlats: boolean,
  labels: { diatonic: string; borrowed: string; chromatic: string } = {
    diatonic: "Diatonic", borrowed: "Borrowed", chromatic: "Chromatic",
  },
): LabeledSelectGroup[] {
  const parent = getHarmonyParentScale(scaleName);
  const degreesMap = getDegreesForScale(parent);
  const roots = getScaleRoots(scaleName, tonicNote);
  // Relative scale intervals drive auto-accidental spelling: in-scale roots are
  // spelled by the heptatonic letter cycle (one letter per degree — C minor's
  // 3rd is E♭, not D♯), matching the fretboard. Out-of-scale (borrowed /
  // chromatic) roots fall back to the preferFlats flip inside this helper.
  const scaleIntervals = SCALES[parent] ?? [];

  const diatonic: LabeledSelectGroup["options"] = [];
  const borrowed: LabeledSelectGroup["options"] = [];
  const chromatic: LabeledSelectGroup["options"] = [];

  for (const r of roots) {
    const display = formatAccidental(
      getNoteDisplayInScale(r.note, tonicNote, scaleIntervals, preferFlats),
    );
    if (r.rootClass === "diatonic") {
      const numeral = degreesMap[r.offset] ?? "";
      const hint = QUALITY_HINT[r.defaultQuality ?? "M"] ?? r.defaultQuality ?? "";
      diatonic.push({ value: r.note, label: `${numeral} · ${display} · ${hint}` });
    } else if (r.rootClass === "borrowed") {
      const numeral = nonDiatonicNumeral(r.offset, preferFlats);
      const guessedKey = guessQualityForBorrowedRoot(r.note, scaleName, tonicNote);
      const guessed = QUALITY_HINT[guessedKey] ?? guessedKey ?? "maj";
      const move = getHarmonicMoveAnnotation(PLAIN_NUMERAL_BY_OFFSET[r.offset] ?? "");
      const suffix = move ? ` — ${move}` : "";
      borrowed.push({ value: r.note, label: `${numeral} · ${display} · ${guessed}${suffix}` });
    } else {
      const numeral = nonDiatonicNumeral(r.offset, preferFlats);
      chromatic.push({ value: r.note, label: `${numeral} · ${display}` });
    }
  }

  const groups: LabeledSelectGroup[] = [{ groupLabel: labels.diatonic, options: diatonic }];
  if (borrowed.length) groups.push({ groupLabel: labels.borrowed, options: borrowed });
  if (chromatic.length) groups.push({ groupLabel: labels.chromatic, options: chromatic });
  return groups;
}

/** Classify a chosen root note (used by the selection handler to decide
 *  diatonic vs manual-root). */
export function classifyRoot(
  scaleName: string,
  tonicNote: string,
  note: string,
): { inScale: boolean; numeral: string } {
  const parent = getHarmonyParentScale(scaleName);
  const degreesMap = getDegreesForScale(parent);
  const roots = getScaleRoots(scaleName, tonicNote);
  const match = roots.find((r) => r.note === note);
  if (match?.rootClass === "diatonic") {
    return { inScale: true, numeral: degreesMap[match.offset] ?? "" };
  }
  const offset = match?.offset ?? ((NOTES.indexOf(note) - NOTES.indexOf(tonicNote) + 12) % 12);
  return { inScale: false, numeral: PLAIN_NUMERAL_BY_OFFSET[offset] ?? "" };
}
