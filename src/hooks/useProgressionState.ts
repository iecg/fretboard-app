import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  activeProgressionStepIndexAtom,
  activeResolvedProgressionStepAtom,
  addProgressionStepAtom,
  advanceProgressionPlaybackAtom,
  beatsPerBarAtom,
  currentProgressionBarAtom,
  currentProgressionPresetIdAtom,
  loadProgressionPresetAtom,
  moveProgressionStepAtom,
  previousProgressionStepAtom,
  progressionBassEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionEnabledAtom,
  progressionLoopEnabledAtom,
  progressionMetronomeEnabledAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  progressionStepDurationMsAtom,
  progressionStepDeadlineAtom,
  progressionStepsAtom,
  progressionStrumEnabledAtom,
  progressionTempoBpmAtom,
  removeProgressionStepAtom,
  resolvedProgressionStepsAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
  totalProgressionBarsAtom,
  updateProgressionStepDegreeAtom,
  updateProgressionStepDurationAtom,
  updateProgressionStepQualityAtom,
} from "../store/atoms";

export function useProgressionState() {
  const [progressionEnabled, setProgressionEnabled] = useAtom(progressionEnabledAtom);
  const [progressionTempoBpm, setProgressionTempoBpm] = useAtom(progressionTempoBpmAtom);
  const [progressionLoopEnabled, setProgressionLoopEnabled] = useAtom(progressionLoopEnabledAtom);
  const [progressionStrumEnabled, setProgressionStrumEnabled] = useAtom(progressionStrumEnabledAtom);
  const [progressionBassEnabled, setProgressionBassEnabled] = useAtom(progressionBassEnabledAtom);
  const [progressionDrumsEnabled, setProgressionDrumsEnabled] = useAtom(progressionDrumsEnabledAtom);
  const [progressionMetronomeEnabled, setProgressionMetronomeEnabled] = useAtom(progressionMetronomeEnabledAtom);
  const progressionSteps = useAtomValue(progressionStepsAtom);
  const resolvedProgressionSteps = useAtomValue(resolvedProgressionStepsAtom);
  const activeProgressionStepIndex = useAtomValue(activeProgressionStepIndexAtom);
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
    progressionEnabled,
    setProgressionEnabled,
    progressionSteps,
    resolvedProgressionSteps,
    activeProgressionStepIndex,
    activeResolvedProgressionStep,
    progressionTempoBpm,
    setProgressionTempoBpm,
    progressionLoopEnabled,
    setProgressionLoopEnabled,
    progressionStrumEnabled,
    setProgressionStrumEnabled,
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
    setActiveProgressionStepIndex: useSetAtom(setProgressionActiveStepIndexAtom),
    addProgressionStep: useSetAtom(addProgressionStepAtom),
    removeProgressionStep: useSetAtom(removeProgressionStepAtom),
    moveProgressionStep: useSetAtom(moveProgressionStepAtom),
    updateProgressionStepDegree: useSetAtom(updateProgressionStepDegreeAtom),
    updateProgressionStepDuration: useSetAtom(updateProgressionStepDurationAtom),
    updateProgressionStepQuality: useSetAtom(updateProgressionStepQualityAtom),
    setProgressionPlaying: useSetAtom(setProgressionPlayingAtom),
    advanceProgressionPlayback: useSetAtom(advanceProgressionPlaybackAtom),
    previousProgressionStep: useSetAtom(previousProgressionStepAtom),
  };
}
