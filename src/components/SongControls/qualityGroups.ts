import type { LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import {
  CHORD_TYPE_DISPLAY_ORDER,
  CHORD_TYPE_SHORT_LABELS,
} from "../ChordOverlayControls/chordTypeOptions";
import { getScaleRoots } from "@fretflow/core";
import { guessQualityForBorrowedRoot } from "@fretflow/fretboard/progressions/progressionDomain";

interface QualityGroupLabels {
  triads: string;
  sus: string;
  sixths: string;
  sevenths: string;
  extensions: string;
}

const TRIAD_KEYS: readonly string[] = [
  "M",
  "m",
  "dim",
  "aug",
];

const SUS_KEYS: readonly string[] = [
  "sus2",
  "sus4",
  "5",
];

const SIXTH_KEYS: readonly string[] = [
  "6",
  "m6",
];

const SEVENTH_KEYS: readonly string[] = [
  "maj7",
  "m7",
  "7",
  "dim7",
  "m7b5",
  "mMaj7",
];

const EXTENSION_KEYS: readonly string[] = [
  "add9",
  "9",
  "maj9",
  "m9",
  "6/9",
  "9sus4",
  "13",
  "maj13",
  "m13",
];

function toOptions(keys: readonly string[]) {
  return keys
    .filter((k) => CHORD_TYPE_DISPLAY_ORDER.includes(k))
    .map((k) => ({
      value: k,
      label: CHORD_TYPE_SHORT_LABELS[k] ?? k,
    }));
}

const SEVENTH_FOR_TRIAD: Record<string, string> = {
  M: "maj7",
  m: "m7",
  dim: "m7b5", // diatonic 7th of a dim triad is half-diminished (m7♭5), not dim7
  aug: "maj7", // unreachable for standard scales (aug degrees collapse to "M"); placeholder
};

export interface QualityGroupLabelsWithDiatonic extends QualityGroupLabels {
  diatonic: string;
}

/** Builds the quality groups with a leading "Diatonic" group reflecting the
 *  triad + seventh for the active root in the active scale. For out-of-scale
 *  roots it falls back to guessQualityForBorrowedRoot. Omits the Diatonic group
 *  when no quality can be derived. */
export function buildQualityGroupsWithDiatonic(
  scaleName: string,
  tonicNote: string,
  rootNote: string,
  labels: QualityGroupLabelsWithDiatonic,
): LabeledSelectGroup[] {
  const base = buildQualitySelectGroups(labels);

  const roots = getScaleRoots(scaleName, tonicNote);
  const match = roots.find((r) => r.note === rootNote);

  let triadQuality: string | null = null;
  if (match?.rootClass === "diatonic" && match.defaultQuality) {
    triadQuality = match.defaultQuality;
  } else {
    const guessed = guessQualityForBorrowedRoot(rootNote, scaleName, tonicNote);
    triadQuality = guessed || null;
  }
  if (!triadQuality) return base;

  const diatonicOptions = [
    { value: triadQuality, label: CHORD_TYPE_SHORT_LABELS[triadQuality] ?? triadQuality },
  ];
  const seventh = SEVENTH_FOR_TRIAD[triadQuality];
  if (seventh && seventh !== triadQuality) {
    diatonicOptions.push({ value: seventh, label: CHORD_TYPE_SHORT_LABELS[seventh] ?? seventh });
  }

  // Radix Select requires unique item values. The diatonic chord is shown in
  // the Diatonic group; remove those values from the categorical base groups so
  // each value appears exactly once.
  const diatonicValues = new Set(diatonicOptions.map((o) => o.value));
  const dedupedBase = base
    .map((group) => ({
      ...group,
      options: group.options.filter((o) => !diatonicValues.has(o.value)),
    }))
    .filter((group) => group.options.length > 0);

  return [{ groupLabel: labels.diatonic, options: diatonicOptions }, ...dedupedBase];
}

function buildQualitySelectGroups(
  labels: QualityGroupLabels,
): LabeledSelectGroup[] {
  return [
    { groupLabel: labels.triads, options: toOptions(TRIAD_KEYS) },
    { groupLabel: labels.sus, options: toOptions(SUS_KEYS) },
    { groupLabel: labels.sixths, options: toOptions(SIXTH_KEYS) },
    { groupLabel: labels.sevenths, options: toOptions(SEVENTH_KEYS) },
    { groupLabel: labels.extensions, options: toOptions(EXTENSION_KEYS) },
  ];
}
