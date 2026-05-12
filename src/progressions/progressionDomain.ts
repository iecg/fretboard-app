import {
  CHORD_DEFINITIONS,
  formatAccidental,
  getDegreeSequence,
  getDiatonicChord,
  getNoteDisplay,
  type DegreeId,
} from "@fretflow/core";

export type ProgressionStepDuration = "1-beat" | "2-beats" | "1-bar" | "2-bars";

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

export const PROGRESSION_DURATIONS = [
  "1-beat",
  "2-beats",
  "1-bar",
  "2-bars",
] as const;

export const PROGRESSION_DURATION_LABELS: Record<ProgressionStepDuration, string> = {
  "1-beat": "1 beat",
  "2-beats": "2 beats",
  "1-bar": "1 bar",
  "2-bars": "2 bars",
};

export const DEFAULT_PROGRESSION_TEMPO_BPM = 90;
export const MIN_PROGRESSION_TEMPO_BPM = 40;
export const MAX_PROGRESSION_TEMPO_BPM = 240;

const oneBar = (degree: DegreeId, qualityOverride: string | null = null) => ({
  degree,
  duration: "1-bar" as const,
  qualityOverride,
});

export const PROGRESSION_PRESETS = [
  {
    id: "one-five-six-four",
    label: "I-V-vi-IV",
    steps: [oneBar("I"), oneBar("V"), oneBar("vi"), oneBar("IV")],
  },
  {
    id: "two-five-one",
    label: "ii-V-I",
    steps: [oneBar("ii"), oneBar("V", "Dominant 7th"), oneBar("I")],
  },
  {
    id: "one-six-four-five",
    label: "I-vi-IV-V",
    steps: [oneBar("I"), oneBar("vi"), oneBar("IV"), oneBar("V")],
  },
  {
    id: "one-four-five",
    label: "I-IV-V",
    steps: [oneBar("I"), oneBar("IV"), oneBar("V")],
  },
  {
    id: "twelve-bar-blues",
    label: "12-bar blues",
    steps: [
      "I",
      "I",
      "I",
      "I",
      "IV",
      "IV",
      "I",
      "I",
      "V",
      "IV",
      "I",
      "V",
    ].map((degree) => oneBar(degree, "Dominant 7th")),
  },
] as const satisfies readonly ProgressionPreset[];

const ROMAN_ORDINALS: Record<string, number> = {
  I: 0,
  II: 1,
  III: 2,
  IV: 3,
  V: 4,
  VI: 5,
  VII: 6,
};

const ROMAN_ORDINAL_TOKEN_PATTERN = /^(VII|III|VI|IV|II|V|I)(?:[°+])?$/i;
const PROGRESSION_DURATION_SET = new Set<string>(PROGRESSION_DURATIONS);

let fallbackProgressionStepId = 0;

export function createProgressionStepId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  fallbackProgressionStepId += 1;
  return `progression-step-${fallbackProgressionStepId}`;
}

export function createProgressionStep(
  step: Omit<ProgressionStep, "id">,
  id = createProgressionStepId(),
): ProgressionStep {
  return { id, ...step };
}

export function isProgressionDuration(value: unknown): value is ProgressionStepDuration {
  return typeof value === "string" && PROGRESSION_DURATION_SET.has(value);
}

export function isValidProgressionStep(value: unknown): value is ProgressionStep {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.degree === "string" &&
    isProgressionDuration(candidate.duration) &&
    (candidate.qualityOverride === null ||
      typeof candidate.qualityOverride === "string")
  );
}

export function getDegreeOrdinal(degree: DegreeId): number | null {
  const match = ROMAN_ORDINAL_TOKEN_PATTERN.exec(degree);
  const prefix = match?.[1].toUpperCase();

  return prefix ? ROMAN_ORDINALS[prefix] : null;
}

export function remapDegreeByOrdinal(
  degree: DegreeId,
  toScaleName: string,
): DegreeId {
  const ordinal = getDegreeOrdinal(degree);
  if (ordinal === null) return degree;

  return getDegreeSequence(toScaleName)[ordinal] ?? degree;
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

export function getProgressionDurationBeats(
  duration: ProgressionStepDuration,
): number {
  switch (duration) {
    case "1-beat":
      return 1;
    case "2-beats":
      return 2;
    case "1-bar":
      return 4;
    case "2-bars":
      return 8;
  }
}

export function getProgressionDurationMs(
  duration: ProgressionStepDuration,
  tempoBpm: number,
): number {
  const normalizedTempo = Number.isFinite(tempoBpm)
    ? tempoBpm
    : DEFAULT_PROGRESSION_TEMPO_BPM;
  const clampedTempo = Math.min(
    MAX_PROGRESSION_TEMPO_BPM,
    Math.max(MIN_PROGRESSION_TEMPO_BPM, Math.round(normalizedTempo)),
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

  const hasValidOverride =
    step.qualityOverride !== null && Boolean(CHORD_DEFINITIONS[step.qualityOverride]);
  const quality = hasValidOverride ? step.qualityOverride : diatonic.quality;
  const displayRoot = formatAccidental(
    getNoteDisplay(diatonic.root, rootNote, useFlats),
  );

  return {
    ...step,
    index,
    root: diatonic.root,
    quality,
    diatonicQuality: diatonic.quality,
    label: step.degree,
    resolvedChordLabel: `${displayRoot} ${quality}`,
    unavailable: false,
    unavailableReason: null,
    qualityOverrideApplied: hasValidOverride && quality !== diatonic.quality,
    invalidQualityOverride:
      step.qualityOverride !== null && !CHORD_DEFINITIONS[step.qualityOverride],
  };
}

export function findFirstResolvableStepIndex(
  resolvedSteps: readonly ResolvedProgressionStep[],
): number | null {
  const index = resolvedSteps.findIndex((step) => !step.unavailable);
  return index === -1 ? null : index;
}

export function findNextResolvableStepIndex(
  resolvedSteps: readonly ResolvedProgressionStep[],
  currentIndex: number,
  direction: -1 | 1,
  loop: boolean,
): number | null {
  if (resolvedSteps.length === 0 || resolvedSteps.every((step) => step.unavailable)) {
    return null;
  }

  let nextIndex = currentIndex;
  for (let checked = 0; checked < resolvedSteps.length; checked += 1) {
    nextIndex += direction;

    if (!loop && (nextIndex < 0 || nextIndex >= resolvedSteps.length)) {
      return null;
    }

    if (nextIndex < 0) nextIndex = resolvedSteps.length - 1;
    if (nextIndex >= resolvedSteps.length) nextIndex = 0;

    if (!resolvedSteps[nextIndex].unavailable) return nextIndex;
  }

  return null;
}

export function clampProgressionIndex(
  index: number,
  steps: readonly ProgressionStep[],
): number {
  if (steps.length === 0) return 0;
  return Math.min(steps.length - 1, Math.max(0, index));
}
