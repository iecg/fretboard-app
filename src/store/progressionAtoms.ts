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
  getProgressionDurationMs,
  isProgressionDuration,
  isValidProgressionStep,
  remapProgressionStepsForScale,
  resolveProgressionStep,
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

const DEFAULT_STEPS: ProgressionStep[] = [
  { id: "default-i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "default-v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "default-vi", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "default-iv", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
];

const progressionStepsStorage = createStorage<ProgressionStep[]>({
  serialize: (value) => JSON.stringify(value),
  deserialize: (value) => JSON.parse(value) as ProgressionStep[],
  validate: (value) => Array.isArray(value) && value.every(isValidProgressionStep),
  onRead: (value) => value.filter(isValidProgressionStep),
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
  return getProgressionDurationMs(step.duration, get(progressionTempoBpmAtom), DEFAULT_BEATS_PER_BAR);
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
  if (next.length === 0) set(progressionPlayingStateAtom, false);
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
      ? getProgressionDurationMs(nextStep.duration, get(progressionTempoBpmAtom), DEFAULT_BEATS_PER_BAR)
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
  if (next !== null) set(activeProgressionStepIndexAtom, next);
});

export const resetProgressionAtomsAtom = atom(null, (_get, set) => {
  set(progressionEnabledAtom, RESET);
  set(progressionStepsAtom, RESET);
  set(progressionTempoBpmAtom, RESET);
  set(progressionLoopEnabledAtom, RESET);
  set(activeProgressionStepIndexAtom, 0);
  set(progressionPlayingStateAtom, false);
  set(progressionStepDeadlineAtom, null);
});
