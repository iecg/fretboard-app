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

export function isProgressionDurationUnit(value: unknown): value is ProgressionStepDurationUnit {
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
  const noun = duration.unit === "beat" ? "beat" : "bar";
  return `${duration.value} ${noun}${duration.value === 1 ? "" : "s"}`;
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
  const candidate = value as ProgressionStep & { duration: unknown };
  return typeof candidate.id === "string"
    && typeof candidate.degree === "string"
    && (isProgressionDuration(candidate.duration) || typeof candidate.duration === "string")
    && (candidate.qualityOverride === null || typeof candidate.qualityOverride === "string");
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

export function getProgressionDurationBeats(duration: ProgressionStepDuration): number {
  if (duration.unit === "beat") return duration.value;
  // bar = 4 beats per bar
  return duration.value * 4;
}

export function getProgressionDurationMs(
  duration: ProgressionStepDuration,
  tempoBpm: number,
): number {
  const clampedTempo = Math.min(
    MAX_PROGRESSION_TEMPO_BPM,
    Math.max(MIN_PROGRESSION_TEMPO_BPM, Math.round(tempoBpm)),
  );
  return Math.round((60_000 / clampedTempo) * getProgressionDurationBeats(duration));
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
