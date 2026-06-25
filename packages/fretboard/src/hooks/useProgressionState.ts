import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeProgressionStepIndexAtom, activeResolvedProgressionStepAtom, addProgressionStepAtom, auditionActiveAtom, duplicateProgressionStepAtom, advanceProgressionPlaybackAtom, applyGenreStyleAtom, beatsPerBarAtom, currentProgressionBarAtom, currentProgressionPresetIdAtom, displayedProgressionStepIndexAtom, loadProgressionPresetAtom, loadProgressionSuggestionAtom, moveProgressionStepAtom, previousProgressionStepAtom, progressionBassEnabledAtom, progressionChordEnabledAtom, progressionDrumsEnabledAtom, progressionGenreStyleAtom, progressionLoopEnabledAtom, progressionMetronomeEnabledAtom, progressionPlaybackBlockedReasonAtom, progressionPlayingAtom, progressionStepDurationMsAtom, progressionStepDeadlineAtom, progressionStepsAtom, progressionTempoBpmAtom, qualityLockAtom, removeProgressionStepAtom, reorderProgressionStepsAtom, requestAuditionAtom, resolvedProgressionStepsAtom, selectProgressionStepRootAtom, setProgressionActiveStepIndexAtom, setProgressionPlayingAtom, totalProgressionBarsAtom, updateProgressionStepDegreeAtom, updateProgressionStepDurationAtom, updateProgressionStepQualityAtom } from "../store/progressionAtoms";

export function useProgressionState() {
  const [progressionTempoBpm, setProgressionTempoBpm] = useAtom(progressionTempoBpmAtom);
  const [progressionLoopEnabled, setProgressionLoopEnabled] = useAtom(progressionLoopEnabledAtom);
  const auditionActive = useAtomValue(auditionActiveAtom);
  const [progressionChordEnabled, setProgressionChordEnabled] = useAtom(progressionChordEnabledAtom);
  const progressionStrumEnabled = progressionChordEnabled;
  const setProgressionStrumEnabled = setProgressionChordEnabled;
  const [progressionBassEnabled, setProgressionBassEnabled] = useAtom(progressionBassEnabledAtom);
  const progressionGenreStyle = useAtomValue(progressionGenreStyleAtom);
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
    auditionActive,
    requestAudition: useSetAtom(requestAuditionAtom),
    progressionStrumEnabled,
    setProgressionStrumEnabled,
    progressionChordEnabled,
    setProgressionChordEnabled,
    progressionGenreStyle,
    applyGenreStyle: useSetAtom(applyGenreStyleAtom),
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
    reorderProgressionSteps: useSetAtom(reorderProgressionStepsAtom),
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
