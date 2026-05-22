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
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  "Augmented Triad",
];

const SUS_KEYS: readonly string[] = [
  "Sus2",
  "Sus4",
  "Power Chord (5)",
];

const SIXTH_KEYS: readonly string[] = [
  "Major 6th",
  "Minor 6th",
];

const SEVENTH_KEYS: readonly string[] = [
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  "Diminished 7th",
  "Half-Diminished 7th",
  "Minor-Major 7th",
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
