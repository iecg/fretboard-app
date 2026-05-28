import type { LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import {
  CHORD_TYPE_DISPLAY_ORDER,
  CHORD_TYPE_SHORT_LABELS,
} from "../ChordOverlayControls/chordTypeOptions";

export interface QualityGroupLabels {
  triads: string;
  sus: string;
  sixths: string;
  sevenths: string;
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

function toOptions(keys: readonly string[]) {
  return keys
    .filter((k) => CHORD_TYPE_DISPLAY_ORDER.includes(k))
    .map((k) => ({
      value: k,
      label: CHORD_TYPE_SHORT_LABELS[k] ?? k,
    }));
}

export function buildQualitySelectGroups(
  labels: QualityGroupLabels,
): LabeledSelectGroup[] {
  return [
    { groupLabel: labels.triads, options: toOptions(TRIAD_KEYS) },
    { groupLabel: labels.sus, options: toOptions(SUS_KEYS) },
    { groupLabel: labels.sixths, options: toOptions(SIXTH_KEYS) },
    { groupLabel: labels.sevenths, options: toOptions(SEVENTH_KEYS) },
  ];
}
