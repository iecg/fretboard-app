import {
  getScaleRoots,
  getHarmonyParentScale,
  getHarmonicMoveAnnotation,
  getDegreesForScale,
  getNoteDisplay,
  formatAccidental,
  NOTES,
} from "@fretflow/core";
import type { LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { guessQualityForBorrowedRoot, qualityShortForm } from "../../progressions/progressionDomain";

const QUALITY_HINT: Record<string, string> = { M: "maj", m: "min", dim: "dim", aug: "aug" };

// Quality-neutral chromatic numerals by semitone offset (lowercase = convention
// neutral). Diatonic-position offsets reuse the scale's own numeral map.
const FLAT_NUMERAL_BY_OFFSET: Record<number, string> = {
  1: "♭ii", 3: "♭iii", 6: "♭v", 8: "♭vi", 10: "♭vii",
};
const SHARP_NUMERAL_BY_OFFSET: Record<number, string> = {
  1: "♯i", 3: "♯ii", 6: "♯iv", 8: "♯v", 10: "♯vi",
};
// Plain (accidental-keyed, uppercase) numerals for annotation lookup.
const PLAIN_NUMERAL_BY_OFFSET: Record<number, string> = {
  1: "bII", 3: "bIII", 6: "bV", 8: "bVI", 10: "bVII",
};

function nonDiatonicNumeral(offset: number, preferFlats: boolean): string {
  const map = preferFlats ? FLAT_NUMERAL_BY_OFFSET : SHARP_NUMERAL_BY_OFFSET;
  return map[offset] ?? "";
}

export function buildChordRootGroups(
  scaleName: string,
  tonicNote: string,
  preferFlats: boolean,
): LabeledSelectGroup[] {
  const parent = getHarmonyParentScale(scaleName);
  const degreesMap = getDegreesForScale(parent);
  const roots = getScaleRoots(scaleName, tonicNote);

  const diatonic: LabeledSelectGroup["options"] = [];
  const borrowed: LabeledSelectGroup["options"] = [];
  const chromatic: LabeledSelectGroup["options"] = [];

  for (const r of roots) {
    const display = formatAccidental(getNoteDisplay(r.note, tonicNote, preferFlats));
    if (r.rootClass === "diatonic") {
      const numeral = degreesMap[r.offset] ?? "";
      const hint = QUALITY_HINT[r.defaultQuality ?? "M"] ?? r.defaultQuality ?? "";
      diatonic.push({ value: r.note, label: `${numeral} · ${display} · ${hint}` });
    } else if (r.rootClass === "borrowed") {
      const numeral = nonDiatonicNumeral(r.offset, preferFlats);
      const guessed = qualityShortForm(guessQualityForBorrowedRoot(r.note, scaleName, tonicNote)) || "maj";
      const move = getHarmonicMoveAnnotation(PLAIN_NUMERAL_BY_OFFSET[r.offset] ?? "");
      const suffix = move ? ` — ${move}` : "";
      borrowed.push({ value: r.note, label: `${numeral} · ${display} · ${guessed}${suffix}` });
    } else {
      const numeral = nonDiatonicNumeral(r.offset, preferFlats);
      chromatic.push({ value: r.note, label: `${numeral} · ${display}` });
    }
  }

  const groups: LabeledSelectGroup[] = [{ groupLabel: "Diatonic", options: diatonic }];
  if (borrowed.length) groups.push({ groupLabel: "Borrowed", options: borrowed });
  if (chromatic.length) groups.push({ groupLabel: "Chromatic", options: chromatic });
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
