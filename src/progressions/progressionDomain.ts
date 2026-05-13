import {
  CHORD_DEFINITIONS,
  formatAccidental,
  getDegreeSequence,
  getDiatonicChord,
  getNoteDisplay,
  type DegreeId,
} from "@fretflow/core";

export type ProgressionStepDurationUnit = "beat" | "bar";

export interface ProgressionStepDuration {
  value: number;
  unit: ProgressionStepDurationUnit;
}

export const DEFAULT_PROGRESSION_STEP_DURATION: ProgressionStepDuration = {
  value: 1,
  unit: "bar",
};

export const MIN_PROGRESSION_STEP_DURATION_VALUE = 1;
export const MAX_PROGRESSION_STEP_DURATION_VALUE = 16;

const LEGACY_DURATION_MAP: Record<string, ProgressionStepDuration> = {
  "1-beat": { value: 1, unit: "beat" },
  "2-beats": { value: 2, unit: "beat" },
  "1-bar": { value: 1, unit: "bar" },
  "2-bars": { value: 2, unit: "bar" },
};

function isProgressionDurationUnit(value: unknown): value is ProgressionStepDurationUnit {
  return value === "beat" || value === "bar";
}

export function isProgressionDuration(value: unknown): value is ProgressionStepDuration {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ProgressionStepDuration;
  return (
    typeof candidate.value === "number"
    && Number.isInteger(candidate.value)
    && candidate.value >= MIN_PROGRESSION_STEP_DURATION_VALUE
    && candidate.value <= MAX_PROGRESSION_STEP_DURATION_VALUE
    && isProgressionDurationUnit(candidate.unit)
  );
}

export function migrateLegacyDuration(value: unknown): ProgressionStepDuration {
  if (typeof value === "string") {
    return LEGACY_DURATION_MAP[value] ?? { ...DEFAULT_PROGRESSION_STEP_DURATION };
  }
  if (isProgressionDuration(value)) return value;
  return { ...DEFAULT_PROGRESSION_STEP_DURATION };
}

export function formatProgressionDurationLabel(duration: ProgressionStepDuration): string {
  return `${duration.value} ${duration.unit}${duration.value === 1 ? "" : "s"}`;
}

const CHORD_QUALITY_SUFFIX: Record<string, string> = {
  "Major Triad": "",
  "Minor Triad": "m",
  "Diminished Triad": "°",
  "Augmented Triad": "+",
  "Major 6th": "6",
  "Minor 6th": "m6",
  "Major 7th": "maj7",
  "Minor 7th": "m7",
  "Dominant 7th": "7",
  "Diminished 7th": "°7",
  "Half-Diminished 7th": "ø7",
  "Minor-Major 7th": "mMaj7",
};

/**
 * Compact chord label (e.g. "C", "Am", "G7", "Fø7") for tight display
 * surfaces such as the progression track. Falls back to "root quality" when the
 * quality has no registered suffix.
 */
export function formatChordShortLabel(rootLabel: string, quality: string): string {
  const suffix = CHORD_QUALITY_SUFFIX[quality];
  if (suffix === undefined) return `${rootLabel} ${quality}`;
  return `${rootLabel}${suffix}`;
}

export interface FormattedPlaybackPosition {
  current: string;
  total: string;
}

/**
 * Format the DAW-style position readout for the progression track.
 *
 * Returns a bar.beat.subdivision pair such as `01.2.067 / 05.4.000` where:
 * - bar is the 1-indexed bar (zero-padded to width 2)
 * - beat is the 1-indexed beat within the current bar
 * - subdivision is the thousandths offset past the current beat
 *
 * The total uses the rounded-up total bar count and pins beat/subdivision to
 * the meter's last beat, matching how DAWs display the project end position.
 */
export function formatProgressionPlaybackPosition(
  currentProgressionBar: number,
  totalProgressionBars: number,
  beatsPerBar: number,
): FormattedPlaybackPosition {
  const safeBeats = Math.max(1, Math.floor(beatsPerBar));
  const totalBars = Math.max(1, Math.ceil(totalProgressionBars));
  const clampedBar = Math.max(1, Math.min(currentProgressionBar, totalBars));
  const bar = Math.floor(clampedBar);
  const positionInBar = Math.max(0, Math.min(1, clampedBar - bar));
  const beatPos = positionInBar * safeBeats;
  const beatIndex = Math.min(safeBeats - 1, Math.floor(beatPos));
  const beat = beatIndex + 1;
  const subdivision = Math.min(
    999,
    Math.max(0, Math.round((beatPos - Math.floor(beatPos)) * 1000)),
  );

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad3 = (n: number) => String(n).padStart(3, "0");

  return {
    current: `${pad2(bar)}.${beat}.${pad3(subdivision)}`,
    total: `${pad2(totalBars)}.${safeBeats}.000`,
  };
}

export interface ProgressionStep {
  id: string;
  degree: DegreeId;
  duration: ProgressionStepDuration;
  qualityOverride: string | null;
}

export interface ProgressionPreset {
  id: string;
  label: string;
  steps: Array<Omit<ProgressionStep, "id">>;
}

export interface ResolvedProgressionStep extends ProgressionStep {
  index: number;
  root: string | null;
  quality: string | null;
  diatonicQuality: string | null;
  label: string;
  resolvedChordLabel: string | null;
  /**
   * Compact chord label suitable for tight DAW-style surfaces (e.g. "C", "Am",
   * "G7"). Null when the chord cannot be resolved in the current scale.
   */
  shortChordLabel: string | null;
  unavailable: boolean;
  unavailableReason: string | null;
  qualityOverrideApplied: boolean;
  invalidQualityOverride: boolean;
}

export const DEFAULT_PROGRESSION_TEMPO_BPM = 90;
export const MIN_PROGRESSION_TEMPO_BPM = 40;
export const MAX_PROGRESSION_TEMPO_BPM = 240;

export const PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  {
    id: "one-five-six-four",
    label: "I-V-vi-IV",
    steps: [
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ],
  },
  {
    id: "two-five-one",
    label: "ii-V-I",
    steps: [
      { degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ],
  },
  {
    id: "one-six-four-five",
    label: "I-vi-IV-V",
    steps: [
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ],
  },
  {
    id: "one-four-five",
    label: "I-IV-V",
    steps: [
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ],
  },
  {
    id: "twelve-bar-blues",
    label: "12-bar blues",
    steps: [
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      { degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
    ],
  },
] as const;

const ROMAN_ORDINALS: Record<string, number> = {
  I: 0,
  II: 1,
  III: 2,
  IV: 3,
  V: 4,
  VI: 5,
  VII: 6,
};

let fallbackId = 0;

export function createProgressionStep(
  step: Omit<ProgressionStep, "id">,
  id = createProgressionStepId(),
): ProgressionStep {
  return {
    id,
    degree: step.degree,
    duration: step.duration,
    qualityOverride: step.qualityOverride,
  };
}

export function createProgressionStepId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackId += 1;
  return `progression-step-${fallbackId}`;
}

export function isValidProgressionStep(value: unknown): value is ProgressionStep {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ProgressionStep;
  return typeof candidate.id === "string"
    && typeof candidate.degree === "string"
    && isProgressionDuration(candidate.duration)
    && (candidate.qualityOverride === null || typeof candidate.qualityOverride === "string");
}

export function normalizeProgressionStep(value: unknown): ProgressionStep | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as ProgressionStep & { duration: unknown };
  if (typeof candidate.id !== "string" || typeof candidate.degree !== "string") return null;
  if (candidate.qualityOverride !== null && typeof candidate.qualityOverride !== "string") return null;
  return {
    id: candidate.id,
    degree: candidate.degree,
    duration: migrateLegacyDuration(candidate.duration),
    qualityOverride: candidate.qualityOverride ?? null,
  };
}

export function getDegreeOrdinal(degree: DegreeId): number | null {
  const match = degree.toUpperCase().match(/^(VII|VI|IV|V|III|II|I)/);
  if (!match) return null;
  return ROMAN_ORDINALS[match[1]] ?? null;
}

export function remapDegreeByOrdinal(degree: DegreeId, toScaleName: string): DegreeId {
  const ordinal = getDegreeOrdinal(degree);
  const targetDegrees = getDegreeSequence(toScaleName);
  if (ordinal === null) return degree;
  return targetDegrees[ordinal] ?? degree;
}

export function remapProgressionStepsForScale(
  steps: readonly ProgressionStep[],
  toScaleName: string,
): ProgressionStep[] {
  return steps.map((step) => ({
    ...step,
    degree: remapDegreeByOrdinal(step.degree, toScaleName),
  }));
}

export function createStepsFromPreset(
  preset: ProgressionPreset,
  scaleName: string,
): ProgressionStep[] {
  return preset.steps.map((step) =>
    createProgressionStep({
      ...step,
      degree: remapDegreeByOrdinal(step.degree, scaleName),
    }),
  );
}

export const DEFAULT_BEATS_PER_BAR = 4 as const;
export const BEATS_PER_BAR_OPTIONS = [3, 4, 6, 8] as const;
export type BeatsPerBar = (typeof BEATS_PER_BAR_OPTIONS)[number];

export function isBeatsPerBar(value: unknown): value is BeatsPerBar {
  return BEATS_PER_BAR_OPTIONS.includes(value as BeatsPerBar);
}

export function getProgressionDurationBeats(
  duration: ProgressionStepDuration,
  beatsPerBar: number,
): number {
  return duration.unit === "bar" ? duration.value * beatsPerBar : duration.value;
}

export function getProgressionDurationMs(
  duration: ProgressionStepDuration,
  tempoBpm: number,
  beatsPerBar: number,
): number {
  const clampedTempo = Math.min(
    MAX_PROGRESSION_TEMPO_BPM,
    Math.max(MIN_PROGRESSION_TEMPO_BPM, Math.round(tempoBpm)),
  );
  const beats = getProgressionDurationBeats(duration, beatsPerBar);
  return Math.round((60_000 / clampedTempo) * beats);
}

export function totalProgressionBars(
  durations: readonly ProgressionStepDuration[],
  beatsPerBar: number,
): number {
  const totalBeats = durations.reduce(
    (sum, duration) => sum + getProgressionDurationBeats(duration, beatsPerBar),
    0,
  );
  return totalBeats / beatsPerBar;
}

export function resolveProgressionStep(
  step: ProgressionStep,
  scaleName: string,
  rootNote: string,
  index = 0,
  useFlats = false,
): ResolvedProgressionStep {
  const diatonic = getDiatonicChord(step.degree, scaleName, rootNote);
  if (!diatonic) {
    return {
      ...step,
      index,
      root: null,
      quality: null,
      diatonicQuality: null,
      label: step.degree,
      resolvedChordLabel: null,
      shortChordLabel: null,
      unavailable: true,
      unavailableReason: "Degree unavailable in this scale",
      qualityOverrideApplied: false,
      invalidQualityOverride: false,
    };
  }

  const overrideValid =
    step.qualityOverride !== null && CHORD_DEFINITIONS[step.qualityOverride] !== undefined;
  const quality = overrideValid ? step.qualityOverride! : diatonic.quality;
  const rootLabel = formatAccidental(getNoteDisplay(diatonic.root, rootNote, useFlats));

  return {
    ...step,
    index,
    root: diatonic.root,
    quality,
    diatonicQuality: diatonic.quality,
    label: step.degree,
    resolvedChordLabel: `${rootLabel} ${quality}`,
    shortChordLabel: formatChordShortLabel(rootLabel, quality),
    unavailable: false,
    unavailableReason: null,
    qualityOverrideApplied: overrideValid && quality !== diatonic.quality,
    invalidQualityOverride: step.qualityOverride !== null && !overrideValid,
  };
}

export function findFirstResolvableStepIndex(
  steps: readonly ResolvedProgressionStep[],
): number | null {
  const index = steps.findIndex((step) => !step.unavailable);
  return index === -1 ? null : index;
}

export function findNextResolvableStepIndex(
  steps: readonly ResolvedProgressionStep[],
  currentIndex: number,
  direction: -1 | 1,
  loop: boolean,
): number | null {
  if (steps.length === 0) return null;
  for (let offset = 1; offset <= steps.length; offset += 1) {
    const rawIndex = currentIndex + offset * direction;
    if (!loop && (rawIndex < 0 || rawIndex >= steps.length)) return null;
    const wrappedIndex = (rawIndex + steps.length) % steps.length;
    if (!steps[wrappedIndex]?.unavailable) return wrappedIndex;
  }
  return null;
}

export function clampProgressionIndex(
  index: number,
  steps: readonly ProgressionStep[],
): number {
  if (steps.length === 0) return 0;
  return Math.min(Math.max(index, 0), steps.length - 1);
}
