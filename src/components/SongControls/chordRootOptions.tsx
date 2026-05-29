import {
  getScaleRoots,
  getHarmonyParentScale,
  getHarmonicMoveAnnotation,
  getDegreesForScale,
  getNoteDisplayInScale,
  formatAccidental,
  formatChromaticNumeral,
  SCALES,
  NOTES,
} from "@fretflow/core";
import type { LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { guessQualityForBorrowedRoot } from "../../progressions/progressionDomain";
import styles from "./chordRootOptions.module.css";
import shared from "../shared/shared.module.css";

const QUALITY_HINT: Record<string, string> = { M: "maj", m: "min", dim: "dim", aug: "aug" };

/** Columnar option content so degrees / notes / qualities line up across rows.
 *  `srLabel` carries the readable text for the accessible name + typeahead while
 *  the visual grid is aria-hidden (its concatenated text would be unreadable). */
function rootContent(
  srLabel: string,
  degree: string,
  note: string,
  quality?: string,
  move?: string,
) {
  return (
    <>
      <span className={shared["sr-only"]}>{srLabel}</span>
      <span className={styles.row} aria-hidden="true">
        <span className={styles.degree}>{degree}</span>
        <span className={styles.note}>{note}</span>
        {quality ? <span className={styles.quality}>{quality}</span> : null}
        {move ? <span className={styles.move}>{move}</span> : null}
      </span>
    </>
  );
}

// Plain ASCII numerals, keyed by offset, used only to look up colloquial
// harmonic-move annotations (HARMONIC_MOVES keys are quality-neutral ASCII).
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
      diatonic.push({
        value: r.note,
        label: `${numeral} · ${display} · ${hint}`,
        content: rootContent(`${numeral} · ${display} · ${hint}`, numeral, display, hint),
      });
    } else {
      // Borrowed + chromatic share the same shape: the default quality (real
      // parallel-key quality for borrowed, "M" for chromatic) drives both the
      // quality hint AND the Roman-numeral case so they never disagree.
      const qualityKey = guessQualityForBorrowedRoot(r.note, scaleName, tonicNote);
      const hint = QUALITY_HINT[qualityKey] ?? qualityKey ?? "maj";
      const numeral = formatChromaticNumeral(r.offset, qualityKey, preferFlats);
      if (r.rootClass === "borrowed") {
        const move = getHarmonicMoveAnnotation(PLAIN_NUMERAL_BY_OFFSET[r.offset] ?? "");
        const suffix = move ? ` — ${move}` : "";
        borrowed.push({
          value: r.note,
          label: `${numeral} · ${display} · ${hint}${suffix}`,
          content: rootContent(
            `${numeral} · ${display} · ${hint}${suffix}`,
            numeral,
            display,
            hint,
            move ?? undefined,
          ),
        });
      } else {
        chromatic.push({
          value: r.note,
          label: `${numeral} · ${display} · ${hint}`,
          content: rootContent(`${numeral} · ${display} · ${hint}`, numeral, display, hint),
        });
      }
    }
  }

  const groups: LabeledSelectGroup[] = [{ groupLabel: labels.diatonic, options: diatonic }];
  if (borrowed.length) groups.push({ groupLabel: labels.borrowed, options: borrowed });
  if (chromatic.length) groups.push({ groupLabel: labels.chromatic, options: chromatic });
  return groups;
}

/** Classify a chosen root note (used by the selection handler to decide
 *  diatonic vs manual-root) and produce the degree numeral cached on the step.
 *  Non-diatonic numerals use the same canonical formatter as the dropdown so
 *  the progression nav pip, chord title, and fretboard stay in sync. */
export function classifyRoot(
  scaleName: string,
  tonicNote: string,
  note: string,
  preferFlats = false,
): { inScale: boolean; numeral: string } {
  const parent = getHarmonyParentScale(scaleName);
  const degreesMap = getDegreesForScale(parent);
  const roots = getScaleRoots(scaleName, tonicNote);
  const match = roots.find((r) => r.note === note);
  if (match?.rootClass === "diatonic") {
    return { inScale: true, numeral: degreesMap[match.offset] ?? "" };
  }
  const offset = match?.offset ?? ((NOTES.indexOf(note) - NOTES.indexOf(tonicNote) + 12) % 12);
  const qualityKey = guessQualityForBorrowedRoot(note, scaleName, tonicNote);
  return { inScale: false, numeral: formatChromaticNumeral(offset, qualityKey, preferFlats) };
}
