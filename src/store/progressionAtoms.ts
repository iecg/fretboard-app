import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_PROGRESSION_TEMPO_BPM,
  MAX_PROGRESSION_TEMPO_BPM,
  MIN_PROGRESSION_TEMPO_BPM,
  PROGRESSION_PRESETS,
  clampProgressionIndex,
  createProgressionStep,
  createStepsFromPreset,
  findFirstResolvableStepIndex,
  findNextResolvableStepIndex,
  getAvailableProgressionPresets,
  getProgressionPresetStepsForScale,
  getProgressionDurationMs,
  isBeatsPerBar,
  isProgressionDuration,
  isValidProgressionStep,
  normalizeProgressionStep,
  remapProgressionStepsForScale,
  resolveProgressionStep,
  totalProgressionBars,
  type ProgressionStep,
  type ProgressionStepDuration,
} from "../progressions/progressionDomain";
import { fingeringPatternAtom, isChordOverlayPatternDisabled } from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom, useFlatsAtom } from "./scaleAtoms";
import {
  GET_ON_INIT,
  booleanStorage,
  constrainedNumberStorage,
  createStorage,
  k,
} from "../utils/storage";

const beatsPerBarStorage = createStorage<number>({
  serialize: (v) => String(v),
  deserialize: (raw) => Number(raw),
  validate: (v): v is number => typeof v === "number" && isBeatsPerBar(v),
});

const DEFAULT_STEPS: ProgressionStep[] = [
  { id: "default-i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "default-v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "default-vi", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "default-iv", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
];

const progressionStepsStorage = createStorage<ProgressionStep[]>({
  serialize: (value) => JSON.stringify(value),
  deserialize: (value) => JSON.parse(value) as ProgressionStep[],
  validate: (value) => Array.isArray(value),
  onRead: (value) =>
    (value as unknown[])
      .map((entry) => normalizeProgressionStep(entry))
      .filter((step): step is ProgressionStep => step !== null),
  onWrite: (value) => value.filter(isValidProgressionStep),
});

export const progressionEnabledAtom = atomWithStorage<boolean>(
  k("progressionEnabled"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

export const progressionStepsAtom = atomWithStorage<ProgressionStep[]>(
  k("progressionSteps"),
  DEFAULT_STEPS,
  progressionStepsStorage,
  GET_ON_INIT,
);

export const progressionTempoBpmAtom = atomWithStorage<number>(
  k("progressionTempoBpm"),
  DEFAULT_PROGRESSION_TEMPO_BPM,
  constrainedNumberStorage({
    min: MIN_PROGRESSION_TEMPO_BPM,
    max: MAX_PROGRESSION_TEMPO_BPM,
    integer: true,
  }),
  GET_ON_INIT,
);

export const progressionLoopEnabledAtom = atomWithStorage<boolean>(
  k("progressionLoopEnabled"),
  true,
  booleanStorage,
  GET_ON_INIT,
);

/**
 * Backing-track instrument toggles. Persisted so that returning users hear
 * the same groove they left with. Defaults favour the richest sensible
 * experience (strum on by default) while leaving heavier voices off until
 * the user opts in.
 */
export const progressionStrumEnabledAtom = atomWithStorage<boolean>(
  k("progressionStrumEnabled"),
  true,
  booleanStorage,
  GET_ON_INIT,
);

export const progressionBassEnabledAtom = atomWithStorage<boolean>(
  k("progressionBassEnabled"),
  true,
  booleanStorage,
  GET_ON_INIT,
);

export const progressionDrumsEnabledAtom = atomWithStorage<boolean>(
  k("progressionDrumsEnabled"),
  true,
  booleanStorage,
  GET_ON_INIT,
);

/**
 * Metronome is independent of the backing-track toggles so the user can
 * practise to a click without instruments, or layer instruments without a
 * click. Defaults off.
 */
export const progressionMetronomeEnabledAtom = atomWithStorage<boolean>(
  k("progressionMetronomeEnabled"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

export const beatsPerBarAtom = atomWithStorage<number>(
  k("progressionBeatsPerBar"),
  DEFAULT_BEATS_PER_BAR,
  beatsPerBarStorage,
  GET_ON_INIT,
);

export const activeProgressionStepIndexAtom = atom(0);
const progressionPlayingStateAtom = atom(false);
export const progressionStepDeadlineAtom = atom<number | null>(null);

export const resolvedProgressionStepsAtom = atom((get) => {
  const scaleName = get(scaleNameAtom);
  const rootNote = get(rootNoteAtom);
  const useFlats = get(useFlatsAtom);
  return get(progressionStepsAtom).map((step, index) =>
    resolveProgressionStep(step, scaleName, rootNote, index, useFlats),
  );
});

export const totalProgressionBarsAtom = atom((get) => {
  const beatsPerBar = get(beatsPerBarAtom);
  return totalProgressionBars(
    get(progressionStepsAtom).map((step) => step.duration),
    beatsPerBar,
  );
});

export const currentProgressionBarAtom = atom((get) => {
  const beatsPerBar = get(beatsPerBarAtom);
  const steps = get(progressionStepsAtom);
  const activeIndex = clampProgressionIndex(get(activeProgressionStepIndexAtom), steps);
  const elapsedBars = totalProgressionBars(
    steps.slice(0, activeIndex).map((step) => step.duration),
    beatsPerBar,
  );
  return elapsedBars + 1;
});

function stepsMatchPreset(
  steps: readonly ProgressionStep[],
  presetSteps: readonly Omit<ProgressionStep, "id">[],
): boolean {
  if (steps.length !== presetSteps.length) return false;
  return steps.every((step, i) => {
    const p = presetSteps[i];
    return step.degree === p.degree
      && step.duration.value === p.duration.value
      && step.duration.unit === p.duration.unit
      && step.qualityOverride === p.qualityOverride;
  });
}

export const CUSTOM_PRESET_ID = "custom" as const;

export const currentProgressionPresetIdAtom = atom<string>((get) => {
  const steps = get(progressionStepsAtom);
  const scaleName = get(scaleNameAtom);
  const match = getAvailableProgressionPresets(scaleName).find((preset) =>
    stepsMatchPreset(steps, getProgressionPresetStepsForScale(preset, scaleName)),
  );
  return match?.id ?? CUSTOM_PRESET_ID;
});

export const activeProgressionStepAtom = atom((get) => {
  const steps = get(progressionStepsAtom);
  return steps[clampProgressionIndex(get(activeProgressionStepIndexAtom), steps)] ?? null;
});

export const activeResolvedProgressionStepAtom = atom((get) => {
  const steps = get(resolvedProgressionStepsAtom);
  return steps[clampProgressionIndex(get(activeProgressionStepIndexAtom), steps)] ?? null;
});

export const progressionStepDurationMsAtom = atom((get) => {
  const step = get(activeProgressionStepAtom);
  if (!step) return 0;
  const beatsPerBar = get(beatsPerBarAtom);
  return getProgressionDurationMs(step.duration, get(progressionTempoBpmAtom), beatsPerBar);
});

export const progressionPlaybackBlockedReasonAtom = atom((get) => {
  if (!get(progressionEnabledAtom)) return "Enable Progression to start playback.";
  if (isChordOverlayPatternDisabled(get(fingeringPatternAtom))) {
    return "Chord overlay disabled for single/two-string patterns.";
  }
  const resolved = get(resolvedProgressionStepsAtom);
  if (resolved.length === 0) return "Add or load progression steps to start playback.";
  if (findFirstResolvableStepIndex(resolved) === null) {
    return "No progression steps resolve in this scale.";
  }
  return null;
});

export const progressionPlayingAtom = atom((get) => get(progressionPlayingStateAtom));

export const setProgressionActiveStepIndexAtom = atom(null, (get, set, index: number) => {
  set(activeProgressionStepIndexAtom, clampProgressionIndex(index, get(progressionStepsAtom)));
});

export const setProgressionPlayingAtom = atom(null, (get, set, playing: boolean) => {
  if (playing && get(progressionPlaybackBlockedReasonAtom)) {
    set(progressionPlayingStateAtom, false);
    set(progressionStepDeadlineAtom, null);
    return;
  }
  set(progressionPlayingStateAtom, playing);
  set(
    progressionStepDeadlineAtom,
    playing ? Date.now() + get(progressionStepDurationMsAtom) : null,
  );
});

export const loadProgressionPresetAtom = atom(null, (get, set, presetId: string) => {
  const preset = PROGRESSION_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return;
  set(progressionStepsAtom, createStepsFromPreset(preset, get(scaleNameAtom)));
  set(activeProgressionStepIndexAtom, 0);
  set(progressionEnabledAtom, true);
  set(progressionPlayingStateAtom, false);
  set(progressionStepDeadlineAtom, null);
});

export const remapProgressionStepsForScaleAtom = atom(null, (get, set, scaleName: string) => {
  set(progressionStepsAtom, remapProgressionStepsForScale(get(progressionStepsAtom), scaleName));
  const first = findFirstResolvableStepIndex(get(resolvedProgressionStepsAtom));
  set(activeProgressionStepIndexAtom, first ?? 0);
});

export const addProgressionStepAtom = atom(null, (get, set) => {
  const degrees = get(resolvedProgressionStepsAtom).filter((step) => !step.unavailable);
  const previous = get(activeProgressionStepAtom);
  const degree = previous?.degree ?? degrees[0]?.degree ?? "I";
  const next = [
    ...get(progressionStepsAtom),
    createProgressionStep({ degree, duration: { value: 1, unit: "bar" }, qualityOverride: null }),
  ];
  set(progressionStepsAtom, next);
  set(activeProgressionStepIndexAtom, next.length - 1);
});

export const removeProgressionStepAtom = atom(null, (get, set, id: string) => {
  const next = get(progressionStepsAtom).filter((step) => step.id !== id);
  set(progressionStepsAtom, next);
  set(activeProgressionStepIndexAtom, clampProgressionIndex(get(activeProgressionStepIndexAtom), next));
  // Removing the final step leaves nothing to play, so stop playback AND
  // clear the deadline — otherwise the next render of
  // `progressionStepDeadlineAtom` could still hold a stale timer that the
  // playback loop might attempt to honor.
  if (next.length === 0) {
    set(progressionPlayingStateAtom, false);
    set(progressionStepDeadlineAtom, null);
  }
});

export const moveProgressionStepAtom = atom(null, (get, set, update: { id: string; direction: -1 | 1 }) => {
  const steps = get(progressionStepsAtom);
  const from = steps.findIndex((step) => step.id === update.id);
  const to = from + update.direction;
  if (from === -1 || to < 0 || to >= steps.length) return;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  set(progressionStepsAtom, next);
  set(activeProgressionStepIndexAtom, to);
});

export const updateProgressionStepDegreeAtom = atom(null, (get, set, update: { id: string; degree: string }) => {
  set(progressionStepsAtom, get(progressionStepsAtom).map((step) =>
    step.id === update.id ? { ...step, degree: update.degree, qualityOverride: null } : step,
  ));
});

export const updateProgressionStepDurationAtom = atom(null, (get, set, update: { id: string; duration: ProgressionStepDuration }) => {
  if (!isProgressionDuration(update.duration)) return;
  set(progressionStepsAtom, get(progressionStepsAtom).map((step) =>
    step.id === update.id ? { ...step, duration: update.duration } : step,
  ));
});

export const updateProgressionStepQualityAtom = atom(null, (get, set, update: { id: string; qualityOverride: string | null }) => {
  set(progressionStepsAtom, get(progressionStepsAtom).map((step) =>
    step.id === update.id ? { ...step, qualityOverride: update.qualityOverride } : step,
  ));
});

export const advanceProgressionPlaybackAtom = atom(null, (get, set) => {
  const next = findNextResolvableStepIndex(
    get(resolvedProgressionStepsAtom),
    get(activeProgressionStepIndexAtom),
    1,
    get(progressionLoopEnabledAtom),
  );
  if (next === null) {
    set(progressionPlayingStateAtom, false);
    set(progressionStepDeadlineAtom, null);
    return;
  }
  set(activeProgressionStepIndexAtom, next);
  if (get(progressionPlayingStateAtom)) {
    const nextStep = get(progressionStepsAtom)[next];
    const durationMs = nextStep
      ? getProgressionDurationMs(nextStep.duration, get(progressionTempoBpmAtom), get(beatsPerBarAtom))
      : 0;
    set(progressionStepDeadlineAtom, Date.now() + durationMs);
  }
});

export const previousProgressionStepAtom = atom(null, (get, set) => {
  const next = findNextResolvableStepIndex(
    get(resolvedProgressionStepsAtom),
    get(activeProgressionStepIndexAtom),
    -1,
    true,
  );
  if (next === null) return;
  set(activeProgressionStepIndexAtom, next);
  // Mirror `advanceProgressionPlaybackAtom`: when stepping backward during
  // active playback, recompute the deadline from the new step's duration so
  // the playback loop doesn't fire on the previous step's stale timer.
  if (get(progressionPlayingStateAtom)) {
    const nextStep = get(progressionStepsAtom)[next];
    const durationMs = nextStep
      ? getProgressionDurationMs(nextStep.duration, get(progressionTempoBpmAtom), get(beatsPerBarAtom))
      : 0;
    set(progressionStepDeadlineAtom, Date.now() + durationMs);
  }
});

export const resetProgressionAtomsAtom = atom(null, (_get, set) => {
  set(progressionEnabledAtom, RESET);
  set(progressionStepsAtom, RESET);
  set(progressionTempoBpmAtom, RESET);
  set(progressionLoopEnabledAtom, RESET);
  set(progressionStrumEnabledAtom, RESET);
  set(progressionBassEnabledAtom, RESET);
  set(progressionDrumsEnabledAtom, RESET);
  set(progressionMetronomeEnabledAtom, RESET);
  set(beatsPerBarAtom, RESET);
  set(activeProgressionStepIndexAtom, 0);
  set(progressionPlayingStateAtom, false);
  set(progressionStepDeadlineAtom, null);
});
