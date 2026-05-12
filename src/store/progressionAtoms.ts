import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import {
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
import {
  fingeringPatternAtom,
  type FingeringPattern,
} from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom, useFlatsAtom } from "./scaleAtoms";
import {
  GET_ON_INIT,
  booleanStorage,
  constrainedNumberStorage,
  createStorage,
  k,
} from "../utils/storage";

const isChordOverlayPatternDisabled = (pattern: FingeringPattern) =>
  pattern === "one-string" || pattern === "two-strings";

const DEFAULT_STEPS: ProgressionStep[] = [
  { id: "default-i", degree: "I", duration: "1-bar", qualityOverride: null },
  { id: "default-v", degree: "V", duration: "1-bar", qualityOverride: null },
  { id: "default-vi", degree: "vi", duration: "1-bar", qualityOverride: null },
  { id: "default-iv", degree: "IV", duration: "1-bar", qualityOverride: null },
];

const filterValidProgressionSteps = (steps: readonly unknown[]) =>
  steps.filter(isValidProgressionStep);

const normalizeProgressionSteps = (value: unknown): ProgressionStep[] =>
  Array.isArray(value) ? filterValidProgressionSteps(value) : DEFAULT_STEPS;

const progressionStepsStorage = createStorage<ProgressionStep[]>({
  serialize: (value) => JSON.stringify(filterValidProgressionSteps(value)),
  deserialize: (value) => JSON.parse(value) as ProgressionStep[],
  validate: (value) => Array.isArray(value) && value.every(isValidProgressionStep),
  onRead: normalizeProgressionSteps,
  onWrite: filterValidProgressionSteps,
});

export const progressionEnabledAtom = atomWithStorage(
  k("progressionEnabled"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

export const progressionStepsAtom = atomWithStorage(
  k("progressionSteps"),
  DEFAULT_STEPS,
  progressionStepsStorage,
  GET_ON_INIT,
);

export const progressionTempoBpmAtom = atomWithStorage(
  k("progressionTempoBpm"),
  DEFAULT_PROGRESSION_TEMPO_BPM,
  constrainedNumberStorage({
    min: MIN_PROGRESSION_TEMPO_BPM,
    max: MAX_PROGRESSION_TEMPO_BPM,
    integer: true,
  }),
  GET_ON_INIT,
);

export const progressionLoopEnabledAtom = atomWithStorage(
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

export const activeProgressionStepAtom = atom((get): ProgressionStep | null => {
  const steps = get(progressionStepsAtom);
  if (steps.length === 0) return null;
  return steps[clampProgressionIndex(get(activeProgressionStepIndexAtom), steps)]!;
});

export const activeResolvedProgressionStepAtom = atom((get) => {
  const resolvedSteps = get(resolvedProgressionStepsAtom);
  if (resolvedSteps.length === 0) return null;
  return resolvedSteps[
    clampProgressionIndex(get(activeProgressionStepIndexAtom), resolvedSteps)
  ]!;
});

export const progressionStepDurationMsAtom = atom((get) => {
  const step = get(activeProgressionStepAtom);
  if (!step) return 0;
  return getProgressionDurationMs(step.duration, get(progressionTempoBpmAtom));
});

export const progressionPlaybackBlockedReasonAtom = atom((get): string | null => {
  if (!get(progressionEnabledAtom)) return "Enable Progression to start playback.";
  if (isChordOverlayPatternDisabled(get(fingeringPatternAtom))) {
    return "Chord overlay disabled for single/two-string patterns.";
  }

  const resolvedSteps = get(resolvedProgressionStepsAtom);
  if (resolvedSteps.length === 0) {
    return "Add or load progression steps to start playback.";
  }
  if (findFirstResolvableStepIndex(resolvedSteps) === null) {
    return "No progression steps resolve in this scale.";
  }

  return null;
});

export const progressionPlayingAtom = atom((get) => get(progressionPlayingStateAtom));

export const setProgressionActiveStepIndexAtom = atom(
  null,
  (get, set, index: number) => {
    set(
      activeProgressionStepIndexAtom,
      clampProgressionIndex(index, get(progressionStepsAtom)),
    );
  },
);

export const setProgressionPlayingAtom = atom(
  null,
  (get, set, playing: boolean) => {
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
  },
);

export const loadProgressionPresetAtom = atom(
  null,
  (get, set, presetId: string) => {
    const preset = PROGRESSION_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;

    set(progressionStepsAtom, createStepsFromPreset(preset, get(scaleNameAtom)));
    set(activeProgressionStepIndexAtom, 0);
    set(progressionEnabledAtom, true);
    set(progressionPlayingStateAtom, false);
    set(progressionStepDeadlineAtom, null);
  },
);

export const remapProgressionStepsForScaleAtom = atom(
  null,
  (get, set, nextScaleName: string) => {
    set(
      progressionStepsAtom,
      remapProgressionStepsForScale(get(progressionStepsAtom), nextScaleName),
    );

    set(
      activeProgressionStepIndexAtom,
      findFirstResolvableStepIndex(get(resolvedProgressionStepsAtom)) ?? 0,
    );
  },
);

export const addProgressionStepAtom = atom(null, (get, set) => {
  const steps = get(progressionStepsAtom);
  const activeStep = get(activeProgressionStepAtom);
  const firstResolvableStep = get(resolvedProgressionStepsAtom).find(
    (step) => !step.unavailable,
  );
  const degree = activeStep?.degree ?? firstResolvableStep?.degree ?? "I";
  const nextSteps = [
    ...steps,
    createProgressionStep({
      degree,
      duration: "1-bar",
      qualityOverride: null,
    }),
  ];

  set(progressionStepsAtom, nextSteps);
  set(activeProgressionStepIndexAtom, nextSteps.length - 1);
});

export const removeProgressionStepAtom = atom(null, (get, set, id: string) => {
  const steps = get(progressionStepsAtom);
  const activeIndex = get(activeProgressionStepIndexAtom);
  const activeStepId = steps[clampProgressionIndex(activeIndex, steps)]?.id;
  const nextSteps = steps.filter((step) => step.id !== id);
  const nextActiveIndex =
    activeStepId && nextSteps.some((step) => step.id === activeStepId)
      ? nextSteps.findIndex((step) => step.id === activeStepId)
      : clampProgressionIndex(activeIndex, nextSteps);

  set(progressionStepsAtom, nextSteps);
  set(activeProgressionStepIndexAtom, nextActiveIndex);

  if (nextSteps.length === 0) {
    set(progressionPlayingStateAtom, false);
    set(progressionStepDeadlineAtom, null);
  }
});

export const moveProgressionStepAtom = atom(
  null,
  (get, set, update: { id: string; direction: -1 | 1 }) => {
    const steps = get(progressionStepsAtom);
    const activeIndex = get(activeProgressionStepIndexAtom);
    const activeStepId = steps[clampProgressionIndex(activeIndex, steps)]?.id;
    const fromIndex = steps.findIndex((step) => step.id === update.id);
    if (fromIndex === -1) return;

    const toIndex = Math.min(
      steps.length - 1,
      Math.max(0, fromIndex + update.direction),
    );
    if (toIndex === fromIndex) return;

    const nextSteps = [...steps];
    const [step] = nextSteps.splice(fromIndex, 1);
    nextSteps.splice(toIndex, 0, step!);

    set(progressionStepsAtom, nextSteps);
    set(
      activeProgressionStepIndexAtom,
      activeStepId
        ? nextSteps.findIndex((candidate) => candidate.id === activeStepId)
        : clampProgressionIndex(activeIndex, nextSteps),
    );
  },
);

export const updateProgressionStepDegreeAtom = atom(
  null,
  (get, set, update: { id: string; degree: string }) => {
    set(
      progressionStepsAtom,
      get(progressionStepsAtom).map((step) =>
        step.id === update.id
          ? { ...step, degree: update.degree, qualityOverride: null }
          : step,
      ),
    );
  },
);

export const updateProgressionStepDurationAtom = atom(
  null,
  (get, set, update: { id: string; duration: ProgressionStepDuration }) => {
    if (!isProgressionDuration(update.duration)) return;

    set(
      progressionStepsAtom,
      get(progressionStepsAtom).map((step) =>
        step.id === update.id ? { ...step, duration: update.duration } : step,
      ),
    );
  },
);

export const updateProgressionStepQualityAtom = atom(
  null,
  (get, set, update: { id: string; qualityOverride: string | null }) => {
    set(
      progressionStepsAtom,
      get(progressionStepsAtom).map((step) =>
        step.id === update.id
          ? { ...step, qualityOverride: update.qualityOverride }
          : step,
      ),
    );
  },
);

export const advanceProgressionPlaybackAtom = atom(null, (get, set) => {
  const resolvedSteps = get(resolvedProgressionStepsAtom);
  const nextIndex = findNextResolvableStepIndex(
    resolvedSteps,
    get(activeProgressionStepIndexAtom),
    1,
    get(progressionLoopEnabledAtom),
  );

  if (nextIndex === null) {
    set(progressionPlayingStateAtom, false);
    set(progressionStepDeadlineAtom, null);
    return;
  }

  set(activeProgressionStepIndexAtom, nextIndex);
  if (get(progressionPlayingStateAtom)) {
    set(
      progressionStepDeadlineAtom,
      Date.now() +
        getProgressionDurationMs(
          resolvedSteps[nextIndex]!.duration,
          get(progressionTempoBpmAtom),
        ),
    );
  }
});

export const previousProgressionStepAtom = atom(null, (get, set) => {
  const previousIndex = findNextResolvableStepIndex(
    get(resolvedProgressionStepsAtom),
    get(activeProgressionStepIndexAtom),
    -1,
    true,
  );

  if (previousIndex !== null) set(activeProgressionStepIndexAtom, previousIndex);
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
