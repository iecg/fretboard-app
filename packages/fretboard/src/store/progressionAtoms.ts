import { atom } from "jotai";
import { atomWithStorage, RESET, splitAtom } from "jotai/utils";
import { getDegreeSequence, getDiatonicChord } from "@fretflow/core";
import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_PROGRESSION_TEMPO_BPM,
  MAX_PROGRESSION_TEMPO_BPM,
  MIN_PROGRESSION_TEMPO_BPM,
  PROGRESSION_PRESETS,
  clampProgressionIndex,
  createProgressionStep,
  findFirstResolvableStepIndex,
  findNextResolvableStepIndex,
  getProgressionDurationMs,
  isBeatsPerBar,
  isProgressionDuration,
  isValidProgressionStep,
  normalizeProgressionStep,
  remapProgressionStepsForScale,
  resolveProgressionStep,
  totalProgressionBars,
  transposeManualRootForRootChange,
  type ProgressionPresetCategory,
  type ProgressionStep,
  type ProgressionStepDuration,
} from "../progressions/progressionDomain";
import {
  registerRootChangeListener,
  rootNoteAtom,
  scaleNameAtom,
  preferFlatsAtom,
} from "./scaleAtoms";
import { getGenreStyle } from "../progressions/audio/genres";
import {
  GET_ON_INIT,
  booleanStorage,
  constrainedNumberStorage,
  createStorage,
  enumValidator,
  k,
  numberValidator,
  stringValidator,
  withStorageErrorBoundary,
} from "../utils/storage";

const beatsPerBarStorage = createStorage<number>({
  serialize: (v) => String(v),
  deserialize: (raw) => Number(raw),
  validate: numberValidator(isBeatsPerBar),
});

// Must stay in sync with DEFAULT_STEPS (the I-V-vi-IV major progression).
const DEFAULT_PRESET_ID = "one-five-six-four";

const DEFAULT_STEPS: ProgressionStep[] = [
  { id: "default-i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "default-v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "default-vi", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "default-iv", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
];

const stringStorage = createStorage<string>({
  serialize: (v) => v,
  deserialize: (raw) => raw,
  validate: stringValidator(),
});

const stringArrayStorage = createStorage<string[]>({
  serialize: (v) => JSON.stringify(v),
  deserialize: (raw) => JSON.parse(raw) as string[],
  validate: (v): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string"),
});

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

export const progressionStepsAtom = atomWithStorage<ProgressionStep[]>(
  k("progressionSteps.v2"),
  DEFAULT_STEPS,
  progressionStepsStorage,
  GET_ON_INIT,
);

export const progressionStepAtomsAtom = splitAtom(progressionStepsAtom);

/**
 * Phase 2.2: when the user changes the scale **root**, transpose every step's
 * `manualRoot` by the interval from the old root to the new root. Steps with
 * `manualRoot === null` are diatonic and already follow the new key through
 * their `degree`, so they pass through unchanged.
 *
 * Scale-NAME changes (e.g. Major → Natural Minor) intentionally leave
 * `manualRoot` alone — the absolute pitch the user pinned doesn't move when
 * the parent scale's quality shifts. That path is handled by
 * `remapProgressionStepsForScaleAtom`, which only rewrites `degree`.
 */
registerRootChangeListener((prev, next, get, set) => {
  const steps = get(progressionStepsAtom);
  if (steps.every((step) => step.manualRoot == null)) return;
  set(progressionStepsAtom, transposeManualRootForRootChange(steps, prev, next));
});

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
 * Preview — hear how the selected slot sits in context without replaying the
 * whole progression ("Preview" in the UI; "audition" internally). Plays the
 * neighbourhood `prev → selected → next` as a quick ~1-beat-per-chord phrase.
 * Manual only (no auto-audio on edit). These atoms are the UI/keyboard surface;
 * the audio side-effect lives in `useChordAudition`.
 */

/** True while a preview is sounding. Drives the button's Stop state and the
 *  editor's "Previewing" label; a second trigger stops it. Transient. */
export const auditionActiveAtom = atom(false);

/** The progression step index currently sounding during an audition, or null
 *  when no audition is playing. `useChordAudition` advances it through the
 *  window; `displayedProgressionStepIndexAtom` and the progression-track view
 *  model prefer it so the playhead + fretboard follow the audition WITHOUT
 *  moving the edit cursor (`activeProgressionStepIndexAtom`). Transient. */
export const auditionDisplayIndexAtom = atom<number | null>(null);

/** Internal monotonic counter. `useChordAudition` watches it and fires an
 *  audition each time it advances (same observe-a-tick pattern as the playback
 *  hook's tab-restart tick). UI code should fire `requestAuditionAtom`, not
 *  write this directly. */
export const auditionRequestTickAtom = atom(0);

/** Request an audition (button + the `A` shortcut both call this). A request
 *  while a loop is already sounding stops it — the toggle is handled in the
 *  hook; here we only advance the tick it observes. */
export const requestAuditionAtom = atom(null, (get, set) => {
  set(auditionRequestTickAtom, get(auditionRequestTickAtom) + 1);
});

/**
 * Backing-track instrument toggles. Persisted so that returning users hear
 * the same groove they left with. Defaults favour the richest sensible
 * experience (strum on by default) while leaving heavier voices off until
 * the user opts in.
 */
/**
 * Storage for the chord-enable toggle. Pre-rename builds persisted this under
 * `progressionStrumEnabled`; when the new key is absent we migrate the old
 * value so returning users keep their toggle state.
 */
const chordEnabledStorage = createStorage<boolean>({
  serialize: (v) => String(v),
  deserialize: (v) => {
    if (v === "true") return true;
    if (v === "false") return false;
    return undefined as unknown as boolean;
  },
  validate: (v) => typeof v === "boolean",
  migrate: () => {
    const legacy = withStorageErrorBoundary<string>(
      k("progressionStrumEnabled"),
      "",
    ).getRaw();
    if (legacy === "true") return true;
    if (legacy === "false") return false;
    return undefined;
  },
});

export const progressionChordEnabledAtom = atomWithStorage<boolean>(
  k("progressionChordEnabled"),
  true,
  chordEnabledStorage,
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

export type TimeSignatureDenominator = 1 | 2 | 4 | 8 | 16;
const TIME_SIGNATURE_DENOMINATORS: readonly TimeSignatureDenominator[] = [1, 2, 4, 8, 16];

const timeSignatureDenominatorStorage = createStorage<TimeSignatureDenominator>({
  validate: enumValidator(TIME_SIGNATURE_DENOMINATORS),
});

export const timeSignatureDenominatorAtom = atomWithStorage<TimeSignatureDenominator>(
  k("timeSignatureDenominator"),
  4,
  timeSignatureDenominatorStorage,
  GET_ON_INIT,
);

/**
 * Genre / instrument / pattern / swing configuration. Persisted so returning
 * users keep their groove. Defaults reproduce the original behaviour exactly
 * (genre "rock", strum instrument, "pop-8ths"/"root-fifth"/"rock" patterns,
 * no swing).
 */
export const progressionGenreStyleAtom = atomWithStorage<string>(
  k("progressionGenreStyle"),
  "rock",
  stringStorage,
  GET_ON_INIT,
);

export const progressionChordPatternAtom = atomWithStorage<string>(
  k("progressionChordPattern"),
  "pop-8ths",
  stringStorage,
  GET_ON_INIT,
);

export const progressionBassPatternAtom = atomWithStorage<string>(
  k("progressionBassPattern"),
  "root-fifth",
  stringStorage,
  GET_ON_INIT,
);

export const progressionDrumPatternAtom = atomWithStorage<string>(
  k("progressionDrumPattern"),
  "rock",
  stringStorage,
  GET_ON_INIT,
);

export const progressionDrumVariationsAtom = atomWithStorage<string[]>(
  k("progressionDrumVariations"),
  [],
  stringArrayStorage,
  GET_ON_INIT,
);

export const progressionChordVariationsAtom = atomWithStorage<string[]>(
  k("progressionChordVariations"),
  [],
  stringArrayStorage,
  GET_ON_INIT,
);

export const progressionBassVariationsAtom = atomWithStorage<string[]>(
  k("progressionBassVariations"),
  [],
  stringArrayStorage,
  GET_ON_INIT,
);

export const progressionSwingAtom = atomWithStorage<number>(
  k("progressionSwing"),
  0,
  constrainedNumberStorage({ min: 0, max: 0.5, integer: false }),
  GET_ON_INIT,
);

export const applyGenreStyleAtom = atom(null, (_get, set, genreId: string) => {
  const genre = getGenreStyle(genreId);
  if (!genre) return;
  set(progressionGenreStyleAtom, genreId);
  set(progressionChordPatternAtom, genre.chordPattern);
  set(progressionBassPatternAtom, genre.bassPattern);
  set(progressionDrumPatternAtom, genre.drumPattern);
  set(progressionDrumVariationsAtom, genre.drumVariations);
  set(progressionChordVariationsAtom, genre.chordVariations);
  set(progressionBassVariationsAtom, genre.bassVariations);
  set(progressionSwingAtom, genre.swing);
  set(progressionTempoBpmAtom, genre.suggestedTempo);
});

export const activeProgressionStepIndexAtom = atom(0);

/**
 * Primitive RAF-written mirror of the active step index. Written by
 * the visualClock frame loop in the visualClock module during playback 
 * whenever the audio clock crosses into a new step (and reset to 0 on stop).
 * Stays whatever value it last held when playback pauses — consumers should read
 * `displayedProgressionStepIndexAtom` instead, which routes to the logical
 * atom when paused/stopped.
 *
 * Exported for tests and for the snapshot hook; UI code should NOT read this
 * directly.
 */
export const fastDisplayedStepIndexPrimitiveAtom = atom(0);
export const displayedStepIndexPrimitiveAtom = atom(0);

/**
 * The step index every chord-visual derivation should read.
 *
 * - During playback: returns the RAF-written primitive, which advances on the
 *   exact frame the audio clock crosses into the next step (same source the
 *   playhead pulls from). Eliminates the `Tone.Draw` scheduling lag that
 *   caused the highlight to trail the playhead by 1-2 frames per chord
 *   transition.
 * - When stopped/paused: returns the canonical logical index, so editor
 *   selection and chord overlays reflect whichever step the user has
 *   clicked on.
 */
export const displayedProgressionStepIndexAtom = atom((get) => {
  // An active audition wins: the playhead + fretboard follow the chord being
  // auditioned, while the edit cursor stays put.
  const audition = get(auditionDisplayIndexAtom);
  if (audition != null) return audition;
  if (get(progressionPlayingAtom)) {
    return get(displayedStepIndexPrimitiveAtom);
  }
  return get(activeProgressionStepIndexAtom);
});

export const progressionPlayingStateAtom = atom(false);
export const progressionStepDeadlineAtom = atom<number | null>(null);

/**
 * True from the moment `setProgressionPlaying(true)` is honored until the
 * first audio callback fires. Drives the spinner overlay on the play button
 * so the user gets feedback during the AudioContext warm-up + buildAllLayers
 * window (typically 100–800ms on a cold context). Transient — not persisted.
 */
export const progressionPlaybackLoadingAtom = atom<boolean>(false);

export const resolvedProgressionStepsAtom = atom((get) => {
  const scaleName = get(scaleNameAtom);
  const rootNote = get(rootNoteAtom);
  const preferFlats = get(preferFlatsAtom);
  return get(progressionStepsAtom).map((step, index) =>
    resolveProgressionStep(step, scaleName, rootNote, index, preferFlats),
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

export const CUSTOM_PRESET_ID = "custom" as const;

/**
 * The id of the preset / suggestion most recently loaded. Loading establishes
 * the "current selection" the picker reflects; any subsequent step edit clears
 * it (see step-mutation atoms), falling the picker back to "custom". Persisted
 * so a returning user sees the same selection they left with.
 */
export const loadedPresetIdAtom = atomWithStorage<string | null>(
  k("loadedPresetId"),
  DEFAULT_PRESET_ID,
);

export const currentProgressionPresetIdAtom = atom<string>(
  (get) => get(loadedPresetIdAtom) ?? CUSTOM_PRESET_ID,
);

export const activeProgressionStepAtom = atom((get) => {
  const steps = get(progressionStepsAtom);
  return steps[clampProgressionIndex(get(displayedProgressionStepIndexAtom), steps)] ?? null;
});

export const activeResolvedProgressionStepAtom = atom((get) => {
  const steps = get(resolvedProgressionStepsAtom);
  return steps[clampProgressionIndex(get(displayedProgressionStepIndexAtom), steps)] ?? null;
});

export const progressionStepDurationMsAtom = atom((get) => {
  const step = get(activeProgressionStepAtom);
  if (!step) return 0;
  const beatsPerBar = get(beatsPerBarAtom);
  return getProgressionDurationMs(step.duration, get(progressionTempoBpmAtom), beatsPerBar);
});

/**
 * Duration of a single bar in milliseconds at the current tempo / meter. Used
 * to cap the chord-transition lead-in window so long chords don't preview the
 * next chord for multiple bars.
 */
export const progressionBarDurationMsAtom = atom((get) =>
  getProgressionDurationMs(
    { value: 1, unit: "bar" },
    get(progressionTempoBpmAtom),
    get(beatsPerBarAtom),
  ),
);

export const progressionPlaybackBlockedReasonAtom = atom((get) => {
  const resolved = get(resolvedProgressionStepsAtom);
  if (resolved.length === 0) return "Add or load progression steps to start playback.";
  if (findFirstResolvableStepIndex(resolved) === null) {
    return "No progression steps resolve in this scale.";
  }
  return null;
});

export const progressionPlayingAtom = atom((get) => get(progressionPlayingStateAtom));

export const setProgressionActiveStepIndexAtom = atom(null, (get, set, index: number) => {
  const clamped = clampProgressionIndex(index, get(progressionStepsAtom));
  set(activeProgressionStepIndexAtom, clamped);
  // Keep the per-step deadline fresh on every advance DURING PLAYBACK. The audio
  // loop drives steps through here (once per step), and leadInActiveAtom derives
  // its step-relative lead-in progress from this deadline. Without this refresh
  // the deadline would freeze at the first step's end and the lead-in/slide would
  // stick ON for every chord after the first. Mirrors next/previousProgressionStepAtom.
  if (get(progressionPlayingStateAtom)) {
    const step = get(progressionStepsAtom)[clamped];
    if (step) {
      set(
        progressionStepDeadlineAtom,
        Date.now() + getProgressionDurationMs(step.duration, get(progressionTempoBpmAtom), get(beatsPerBarAtom)),
      );
    }
  }
});

/**
 * Atomic "stop": set playing=false AND active step index=0. The orchestrator's
 * Effect 1 tear-down path will dispose the Tone Parts because playing flipped
 * false; the activeIndex reset is what distinguishes Stop from Pause.
 */
export const stopProgressionPlaybackAtom = atom(null, (get, set) => {
  set(progressionPlayingStateAtom, false);
  const resolved = get(resolvedProgressionStepsAtom);
  const firstResolvable = findFirstResolvableStepIndex(resolved);
  set(activeProgressionStepIndexAtom, firstResolvable ?? 0);
  set(progressionStepDeadlineAtom, null);
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

// Maps a preset category to the genre style whose backing-track defaults best
// fit the progression. Loading a preset reapplies the matching genre so the
// backing track (instrument, patterns, swing) follows the preset.
const PRESET_CATEGORY_GENRE: Record<ProgressionPresetCategory, string> = {
  "pop-rock": "rock",
  blues: "blues",
  jazz: "jazz",
  folk: "pop",
  modal: "rock",
  minor: "ballad",
};

export const loadProgressionPresetAtom = atom(null, (_get, set, presetId: string) => {
  const preset = PROGRESSION_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return;
  // Loading establishes harmonic context: set the home scale (base write — no
  // remap) and load degrees verbatim so qualities follow the scale.
  set(scaleNameAtom, preset.scale);
  set(progressionStepsAtom, preset.steps.map((step) => createProgressionStep({ ...step })));
  set(activeProgressionStepIndexAtom, 0);
  set(progressionPlayingStateAtom, false);
  set(progressionStepDeadlineAtom, null);
  set(loadedPresetIdAtom, preset.id);
  const genreId = PRESET_CATEGORY_GENRE[preset.category];
  if (genreId) set(applyGenreStyleAtom, genreId);
});

export const loadProgressionSuggestionAtom = atom(
  null,
  (_get, set, suggestion: { id: string; steps: ReadonlyArray<Omit<ProgressionStep, "id">> }) => {
    if (suggestion.steps.length === 0) return;
    // Suggestions are generated in the current scale, so no scale switch.
    set(progressionStepsAtom, suggestion.steps.map((step) => createProgressionStep({ ...step })));
    set(activeProgressionStepIndexAtom, 0);
    set(progressionPlayingStateAtom, false);
    set(progressionStepDeadlineAtom, null);
    set(loadedPresetIdAtom, suggestion.id);
  },
);

export const remapProgressionStepsForScaleAtom = atom(null, (get, set, scaleName: string) => {
  const steps = get(progressionStepsAtom);
  const nextSteps = remapProgressionStepsForScale(steps, scaleName);
  set(progressionStepsAtom, nextSteps);

  const currentIndex = get(activeProgressionStepIndexAtom);
  const resolved = get(resolvedProgressionStepsAtom);

  if (resolved[currentIndex] && !resolved[currentIndex].unavailable) {
    return;
  }

  const first = findFirstResolvableStepIndex(resolved);
  set(activeProgressionStepIndexAtom, first ?? 0);
});

export const addProgressionStepAtom = atom(null, (get, set) => {
  set(loadedPresetIdAtom, null);
  const tonic = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const previous = get(activeProgressionStepAtom);
  const sequence = getDegreeSequence(scaleName);

  const previousIdx = previous ? sequence.indexOf(previous.degree) : -1;
  const nextIdx = previousIdx >= 0
    ? (previousIdx + 1) % sequence.length
    : 0;
  const degree = sequence[nextIdx] ?? "I";

  const diatonic = getDiatonicChord(degree, scaleName, tonic);
  const qualityOverride = diatonic?.quality ?? null;

  const newStep = createProgressionStep({
    degree,
    duration: { value: 1, unit: "bar" },
    qualityOverride,
  });

  // Insert directly AFTER the selected chord (not at the bottom) so adding while
  // a middle chord is selected drops the new chord where the user is working.
  // Empty list → the new step becomes the first. Mirrors the splice idiom in
  // duplicateProgressionStepAtom, and the cursor follows the inserted step.
  const steps = get(progressionStepsAtom);
  const insertAfter =
    steps.length === 0
      ? -1
      : clampProgressionIndex(get(activeProgressionStepIndexAtom), steps);
  const next = [
    ...steps.slice(0, insertAfter + 1),
    newStep,
    ...steps.slice(insertAfter + 1),
  ];
  set(progressionStepsAtom, next);
  set(activeProgressionStepIndexAtom, insertAfter + 1);
});

export const removeProgressionStepAtom = atom(null, (get, set, id: string) => {
  set(loadedPresetIdAtom, null);
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

/** Move a step from one index to another (drag-and-drop / keyboard reorder).
 *  Single source of truth for reordering: clears the loaded-preset marker (the
 *  sequence no longer matches a stored preset) and lets the active cursor follow
 *  the moved step. No-op for equal or out-of-range indices. */
export const reorderProgressionStepsAtom = atom(null, (get, set, update: { from: number; to: number }) => {
  const steps = get(progressionStepsAtom);
  const { from, to } = update;
  if (from === to || from < 0 || from >= steps.length || to < 0 || to >= steps.length) return;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  set(loadedPresetIdAtom, null);
  set(progressionStepsAtom, next);
  set(activeProgressionStepIndexAtom, to);
});

export const moveProgressionStepAtom = atom(null, (get, set, update: { id: string; direction: -1 | 1 }) => {
  const from = get(progressionStepsAtom).findIndex((step) => step.id === update.id);
  if (from === -1) return;
  set(reorderProgressionStepsAtom, { from, to: from + update.direction });
});

export const duplicateProgressionStepAtom = atom(
  null,
  (get, set, stepId: string) => {
    const steps = get(progressionStepsAtom);
    const index = steps.findIndex((step) => step.id === stepId);
    if (index === -1) {
      return;
    }
    set(loadedPresetIdAtom, null);
    const source = steps[index];
    const copy = createProgressionStep({
      degree: source.degree,
      duration: { ...source.duration },
      qualityOverride: source.qualityOverride,
    });
    set(progressionStepsAtom, [
      ...steps.slice(0, index + 1),
      copy,
      ...steps.slice(index + 1),
    ]);
    set(activeProgressionStepIndexAtom, index + 1);
  },
);

export const updateProgressionStepDegreeAtom = atom(null, (get, set, update: { id: string; degree: string }) => {
  set(loadedPresetIdAtom, null);
  set(progressionStepsAtom, get(progressionStepsAtom).map((step) =>
    step.id === update.id ? { ...step, degree: update.degree } : step,
  ));
});

export const updateProgressionStepDurationAtom = atom(null, (get, set, update: { id: string; duration: ProgressionStepDuration }) => {
  if (!isProgressionDuration(update.duration)) return;
  set(loadedPresetIdAtom, null);
  set(progressionStepsAtom, get(progressionStepsAtom).map((step) =>
    step.id === update.id ? { ...step, duration: update.duration } : step,
  ));
});

export const updateProgressionStepQualityAtom = atom(null, (get, set, update: { id: string; qualityOverride: string | null }) => {
  set(loadedPresetIdAtom, null);
  set(progressionStepsAtom, get(progressionStepsAtom).map((step) =>
    step.id === update.id ? { ...step, qualityOverride: update.qualityOverride } : step,
  ));
});

/** Session-only: when true, changing a step's root preserves its
 *  qualityOverride (jazz/comping "color holds, root walks"). Not persisted. */
export const qualityLockAtom = atom(false);

/** Orchestrates a chord-root selection from the editor dropdown. In-scale
 *  selections revert to diatonic resolution (clear manualRoot, set degree);
 *  borrowed/chromatic selections pin manualRoot and cache the numeral as the
 *  degree hint. Clears qualityOverride unless qualityLockAtom is true. */
export const selectProgressionStepRootAtom = atom(
  null,
  (get, set, update: { id: string; root: string; numeral: string; inScale: boolean }) => {
    const locked = get(qualityLockAtom);
    set(
      progressionStepsAtom,
      get(progressionStepsAtom).map((step) => {
        if (step.id !== update.id) return step;
        const next = { ...step, degree: update.numeral };
        next.manualRoot = update.inScale ? null : update.root;
        if (!locked) next.qualityOverride = null;
        return next;
      }),
    );
  },
);

/**
 * Sets `manualRoot` on the target step. When non-null the step is treated as
 * a manual / out-of-scale chord; when null the step reverts to diatonic
 * resolution from its `degree`. Consumed via `activeChordRootAtom` (and the
 * scale-root transposition listener) in songStateAtoms / Phase 2.4–2.5.
 */
export const updateProgressionStepRootAtom = atom(
  null,
  (get, set, update: { id: string; manualRoot: string | null }) => {
    set(loadedPresetIdAtom, null);
    const next = get(progressionStepsAtom).map((step) =>
      step.id === update.id ? { ...step, manualRoot: update.manualRoot } : step,
    );
    set(progressionStepsAtom, next);
  },
);

/**
 * Updates the cached `degree` on the target step without touching any other
 * field. Used when the resolver wants to refresh the degree hint for a
 * manual-root step or otherwise persist a recomputed degree.
 */
export const updateProgressionStepCachedDegreeAtom = atom(
  null,
  (get, set, update: { id: string; degree: string }) => {
    const next = get(progressionStepsAtom).map((step) =>
      step.id === update.id ? { ...step, degree: update.degree } : step,
    );
    set(progressionStepsAtom, next);
  },
);

export const advanceProgressionPlaybackAtom = atom(null, (get, set) => {
  const allowWrap = get(progressionPlayingStateAtom) && get(progressionLoopEnabledAtom);
  const next = findNextResolvableStepIndex(
    get(resolvedProgressionStepsAtom),
    get(activeProgressionStepIndexAtom),
    1,
    allowWrap,
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
  const allowWrap = get(progressionPlayingStateAtom) && get(progressionLoopEnabledAtom);
  const next = findNextResolvableStepIndex(
    get(resolvedProgressionStepsAtom),
    get(activeProgressionStepIndexAtom),
    -1,
    allowWrap,
  );
  if (next === null) return;
  set(activeProgressionStepIndexAtom, next);
  if (get(progressionPlayingStateAtom)) {
    const nextStep = get(progressionStepsAtom)[next];
    const durationMs = nextStep
      ? getProgressionDurationMs(nextStep.duration, get(progressionTempoBpmAtom), get(beatsPerBarAtom))
      : 0;
    set(progressionStepDeadlineAtom, Date.now() + durationMs);
  }
});

export const resetProgressionAtomsAtom = atom(null, (_get, set) => {
  // Session-only lock isn't an atomWithStorage, so reset it explicitly to its
  // default rather than via RESET — otherwise it survives a progression reset
  // and keeps preserving qualityOverride on the next root change.
  set(qualityLockAtom, false);
  set(progressionStepsAtom, RESET);
  set(progressionTempoBpmAtom, RESET);
  set(progressionLoopEnabledAtom, RESET);
  set(progressionChordEnabledAtom, RESET);
  set(progressionBassEnabledAtom, RESET);
  set(progressionDrumsEnabledAtom, RESET);
  set(progressionMetronomeEnabledAtom, RESET);
  set(beatsPerBarAtom, RESET);
  set(timeSignatureDenominatorAtom, RESET);
  set(progressionGenreStyleAtom, RESET);
  set(progressionChordPatternAtom, RESET);
  set(progressionBassPatternAtom, RESET);
  set(progressionDrumPatternAtom, RESET);
  set(progressionDrumVariationsAtom, RESET);
  set(progressionChordVariationsAtom, RESET);
  set(progressionBassVariationsAtom, RESET);
  set(progressionSwingAtom, RESET);
  set(loadedPresetIdAtom, RESET);
  set(activeProgressionStepIndexAtom, 0);
  set(progressionPlayingStateAtom, false);
  set(progressionStepDeadlineAtom, null);
});
