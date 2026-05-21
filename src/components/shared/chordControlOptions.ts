import { getDegreesForScale, getDegreeSequence } from "@fretflow/core";
import {
  CHORD_NONE_VALUE,
  CHORD_TYPE_DISPLAY_ORDER,
  CHORD_TYPE_SHORT_LABELS,
} from "../ChordOverlayControls/chordTypeOptions";

export interface ToggleOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface BuildDegreeOptionsArgs {
  scaleName: string;
  qualityOverridden?: boolean;
  activeDegree?: string | null;
  /** Optional "Off" sentinel as the first item (used by chord overlay degree mode). */
  includeOffSentinel?: boolean;
  offLabel?: string;
}

export function buildDegreeToggleOptions({
  scaleName,
  qualityOverridden = false,
  activeDegree = null,
  includeOffSentinel = false,
  offLabel = "Off",
}: BuildDegreeOptionsArgs): ToggleOption[] {
  // ChordOverlayControls historically used getDegreesForScale (object), while
  // SongControls used getDegreeSequence (array). They return the same
  // degree set; we prefer getDegreeSequence here for stable ordering.
  const degrees = getDegreeSequence(scaleName) ?? Object.values(getDegreesForScale(scaleName));
  const base: ToggleOption[] = degrees.map((deg) => ({
    value: deg,
    label: qualityOverridden && deg === activeDegree ? `${deg}*` : deg,
  }));
  if (includeOffSentinel) {
    return [{ value: CHORD_NONE_VALUE, label: offLabel }, ...base];
  }
  return base;
}

export const CHORD_QUALITY_DIATONIC_VALUE = CHORD_NONE_VALUE;

export interface BuildQualityOptionsArgs {
  /** Override the label used for the leading sentinel (default "Diatonic"). */
  diatonicLabel?: string;
  /**
   * Whether to prepend the diatonic/Off sentinel as the first option.
   * Defaults to true. Pass false for degree-mode quality pickers that do not
   * need a "no-override" sentinel.
   */
  includeSentinel?: boolean;
}

export function buildQualityToggleOptions({
  diatonicLabel = "Diatonic",
  includeSentinel = true,
}: BuildQualityOptionsArgs = {}): ToggleOption[] {
  const qualities = CHORD_TYPE_DISPLAY_ORDER.map((key) => ({
    value: key,
    label: CHORD_TYPE_SHORT_LABELS[key] ?? key,
  }));
  if (!includeSentinel) {
    return qualities;
  }
  return [{ value: CHORD_QUALITY_DIATONIC_VALUE, label: diatonicLabel }, ...qualities];
}
