import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  activeProgressionStepIndexAtom,
  activeResolvedProgressionStepAtom,
  addProgressionStepAtom,
  advanceProgressionPlaybackAtom,
  loadProgressionPresetAtom,
  moveProgressionStepAtom,
  previousProgressionStepAtom,
  progressionEnabledAtom,
  progressionLoopEnabledAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  progressionStepDurationMsAtom,
  progressionStepDeadlineAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  removeProgressionStepAtom,
  resolvedProgressionStepsAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
  updateProgressionStepDegreeAtom,
  updateProgressionStepDurationAtom,
  updateProgressionStepQualityAtom,
} from "../store/atoms";

export function useProgressionState() {
  const [progressionEnabled, setProgressionEnabled] = useAtom(progressionEnabledAtom);
  const [progressionTempoBpm, setProgressionTempoBpm] = useAtom(progressionTempoBpmAtom);
  const [progressionLoopEnabled, setProgressionLoopEnabled] = useAtom(progressionLoopEnabledAtom);
  const progressionSteps = useAtomValue(progressionStepsAtom);
  const resolvedProgressionSteps = useAtomValue(resolvedProgressionStepsAtom);
  const activeProgressionStepIndex = useAtomValue(activeProgressionStepIndexAtom);
  const activeResolvedProgressionStep = useAtomValue(activeResolvedProgressionStepAtom);
  const progressionPlaying = useAtomValue(progressionPlayingAtom);
  const progressionStepDurationMs = useAtomValue(progressionStepDurationMsAtom);
  const progressionStepDeadline = useAtomValue(progressionStepDeadlineAtom);
  const progressionPlaybackBlockedReason = useAtomValue(progressionPlaybackBlockedReasonAtom);

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
    progressionPlaying,
    progressionStepDurationMs,
    progressionStepDeadline,
    progressionPlaybackBlockedReason,
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
