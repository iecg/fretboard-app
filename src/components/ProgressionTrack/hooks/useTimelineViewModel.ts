import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  activeProgressionStepIndexAtom,
  beatsPerBarAtom,
  currentProgressionBarAtom,
  fastDisplayedStepIndexPrimitiveAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  progressionStepsAtom,
  progressionStepAtomsAtom,
} from "../../../store/progressionAtoms";
import { buildTimelineViewModel } from "./buildTimelineViewModel";

export function useTimelineViewModel() {
  const steps = useAtomValue(progressionStepsAtom);
  const stepAtoms = useAtomValue(progressionStepAtomsAtom);
  const beatsPerBar = useAtomValue(beatsPerBarAtom);
  const activeStepIndex = useAtomValue(activeProgressionStepIndexAtom);
  const displayedStepIndex = useAtomValue(fastDisplayedStepIndexPrimitiveAtom);
  const currentProgressionBar = useAtomValue(currentProgressionBarAtom);
  const playbackBlockedReason = useAtomValue(progressionPlaybackBlockedReasonAtom);
  const playing = useAtomValue(progressionPlayingAtom);

  const staticView = useMemo(
    () => buildTimelineViewModel(steps, beatsPerBar),
    [steps, beatsPerBar],
  );

  const canPlay = !playbackBlockedReason;
  const transportStartBar = playing && canPlay ? currentProgressionBar : 1;

  return {
    ...staticView,
    stepAtoms,
    activeStepIndex,
    displayedStepIndex,
    currentProgressionBar,
    canPlay,
    playing,
    transportStartBar,
    playbackBlockedReason,
  };
}
