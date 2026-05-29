import { useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeProgressionStepIndexAtom, activeResolvedProgressionStepAtom, addProgressionStepAtom, duplicateProgressionStepAtom, advanceProgressionPlaybackAtom, applyGenreStyleAtom, beatsPerBarAtom, currentProgressionBarAtom, currentProgressionPresetIdAtom, displayedProgressionStepIndexAtom, loadProgressionPresetAtom, loadProgressionSuggestionAtom, moveProgressionStepAtom, previousProgressionStepAtom, progressionBassEnabledAtom, progressionBassPatternAtom, progressionChordEnabledAtom, progressionChordInstrumentAtom, progressionChordPatternAtom, progressionDrumPatternAtom, progressionDrumsEnabledAtom, progressionDrumVariationsAtom, progressionGenreStyleAtom, progressionLoopEnabledAtom, progressionMetronomeEnabledAtom, progressionPlaybackBlockedReasonAtom, progressionPlayingAtom, progressionStepDurationMsAtom, progressionStepDeadlineAtom, progressionStepsAtom, progressionSwingAtom, progressionTempoBpmAtom, qualityLockAtom, removeProgressionStepAtom, resolvedProgressionStepsAtom, selectProgressionStepRootAtom, setProgressionActiveStepIndexAtom, setProgressionPlayingAtom, totalProgressionBarsAtom, updateProgressionStepDegreeAtom, updateProgressionStepDurationAtom, updateProgressionStepQualityAtom } from "../store/progressionAtoms";

export function useProgressionState() {
  const [progressionTempoBpm, setProgressionTempoBpm] = useAtom(progressionTempoBpmAtom);
  const [progressionLoopEnabled, setProgressionLoopEnabled] = useAtom(progressionLoopEnabledAtom);
  const [progressionChordEnabled, setProgressionChordEnabled] = useAtom(progressionChordEnabledAtom);
  const progressionStrumEnabled = progressionChordEnabled;
  const setProgressionStrumEnabled = setProgressionChordEnabled;
  const [progressionBassEnabled, setProgressionBassEnabled] = useAtom(progressionBassEnabledAtom);
  const progressionGenreStyle = useAtomValue(progressionGenreStyleAtom);
  const setGenreStyle = useSetAtom(progressionGenreStyleAtom);
  const [progressionChordInstrument, rawSetChordInstrument] = useAtom(progressionChordInstrumentAtom);
  const [progressionChordPattern, rawSetChordPattern] = useAtom(progressionChordPatternAtom);
  const [progressionBassPattern, rawSetBassPattern] = useAtom(progressionBassPatternAtom);
  const [progressionDrumPattern, rawSetDrumPattern] = useAtom(progressionDrumPatternAtom);
  const [progressionDrumVariations, rawSetDrumVariations] = useAtom(progressionDrumVariationsAtom);
  const [progressionSwing, rawSetSwing] = useAtom(progressionSwingAtom);

  // Changing any individual instrument/pattern/swing setting after picking a
  // genre means the active mix no longer matches that genre — revert the
  // genre selector to "custom". `applyGenreStyle` is exempt: it legitimately
  // sets the genre.
  const setProgressionChordInstrument = useCallback(
    (v: typeof progressionChordInstrument) => {
      rawSetChordInstrument(v);
      setGenreStyle("custom");
    },
    [rawSetChordInstrument, setGenreStyle],
  );
  const setProgressionChordPattern = useCallback(
    (v: string) => {
      rawSetChordPattern(v);
      setGenreStyle("custom");
    },
    [rawSetChordPattern, setGenreStyle],
  );
  const setProgressionBassPattern = useCallback(
    (v: string) => {
      rawSetBassPattern(v);
      setGenreStyle("custom");
    },
    [rawSetBassPattern, setGenreStyle],
  );
  const setProgressionDrumPattern = useCallback(
    (v: string) => {
      rawSetDrumPattern(v);
      setGenreStyle("custom");
    },
    [rawSetDrumPattern, setGenreStyle],
  );
  const setProgressionDrumVariations = useCallback(
    (v: string[]) => {
      rawSetDrumVariations(v);
      setGenreStyle("custom");
    },
    [rawSetDrumVariations, setGenreStyle],
  );
  const setProgressionSwing = useCallback(
    (v: number) => {
      rawSetSwing(v);
      setGenreStyle("custom");
    },
    [rawSetSwing, setGenreStyle],
  );
  const [progressionDrumsEnabled, setProgressionDrumsEnabled] = useAtom(progressionDrumsEnabledAtom);
  const [progressionMetronomeEnabled, setProgressionMetronomeEnabled] = useAtom(progressionMetronomeEnabledAtom);
  const progressionSteps = useAtomValue(progressionStepsAtom);
  const resolvedProgressionSteps = useAtomValue(resolvedProgressionStepsAtom);
  const activeProgressionStepIndex = useAtomValue(activeProgressionStepIndexAtom);
  const displayedProgressionStepIndex = useAtomValue(displayedProgressionStepIndexAtom);
  const activeResolvedProgressionStep = useAtomValue(activeResolvedProgressionStepAtom);
  const progressionPlaying = useAtomValue(progressionPlayingAtom);
  const progressionStepDurationMs = useAtomValue(progressionStepDurationMsAtom);
  const progressionStepDeadline = useAtomValue(progressionStepDeadlineAtom);
  const progressionPlaybackBlockedReason = useAtomValue(progressionPlaybackBlockedReasonAtom);
  const [beatsPerBar, setBeatsPerBar] = useAtom(beatsPerBarAtom);
  const totalProgressionBars = useAtomValue(totalProgressionBarsAtom);
  const currentProgressionBar = useAtomValue(currentProgressionBarAtom);
  const currentProgressionPresetId = useAtomValue(currentProgressionPresetIdAtom);

  return {
    progressionSteps,
    resolvedProgressionSteps,
    activeProgressionStepIndex,
    displayedProgressionStepIndex,
    activeResolvedProgressionStep,
    progressionTempoBpm,
    setProgressionTempoBpm,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionStrumEnabled,
    setProgressionStrumEnabled,
    progressionChordEnabled,
    setProgressionChordEnabled,
    progressionGenreStyle,
    applyGenreStyle: useSetAtom(applyGenreStyleAtom),
    progressionChordInstrument,
    setProgressionChordInstrument,
    progressionChordPattern,
    setProgressionChordPattern,
    progressionBassPattern,
    setProgressionBassPattern,
    progressionDrumPattern,
    setProgressionDrumPattern,
    progressionDrumVariations,
    setProgressionDrumVariations,
    progressionSwing,
    setProgressionSwing,
    progressionBassEnabled,
    setProgressionBassEnabled,
    progressionDrumsEnabled,
    setProgressionDrumsEnabled,
    progressionMetronomeEnabled,
    setProgressionMetronomeEnabled,
    progressionPlaying,
    progressionStepDurationMs,
    progressionStepDeadline,
    progressionPlaybackBlockedReason,
    beatsPerBar,
    setBeatsPerBar,
    totalProgressionBars,
    currentProgressionBar,
    currentProgressionPresetId,
    loadProgressionPreset: useSetAtom(loadProgressionPresetAtom),
    loadProgressionSuggestion: useSetAtom(loadProgressionSuggestionAtom),
    setActiveProgressionStepIndex: useSetAtom(setProgressionActiveStepIndexAtom),
    addProgressionStep: useSetAtom(addProgressionStepAtom),
    duplicateProgressionStep: useSetAtom(duplicateProgressionStepAtom),
    removeProgressionStep: useSetAtom(removeProgressionStepAtom),
    moveProgressionStep: useSetAtom(moveProgressionStepAtom),
    updateProgressionStepDegree: useSetAtom(updateProgressionStepDegreeAtom),
    updateProgressionStepDuration: useSetAtom(updateProgressionStepDurationAtom),
    updateProgressionStepQuality: useSetAtom(updateProgressionStepQualityAtom),
    selectProgressionStepRoot: useSetAtom(selectProgressionStepRootAtom),
    qualityLock: useAtomValue(qualityLockAtom),
    setQualityLock: useSetAtom(qualityLockAtom),
    setProgressionPlaying: useSetAtom(setProgressionPlayingAtom),
    advanceProgressionPlayback: useSetAtom(advanceProgressionPlaybackAtom),
    previousProgressionStep: useSetAtom(previousProgressionStepAtom),
  };
}
