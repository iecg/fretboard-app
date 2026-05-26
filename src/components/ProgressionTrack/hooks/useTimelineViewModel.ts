import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  activeProgressionStepIndexAtom,
  beatsPerBarAtom,
  currentProgressionBarAtom,
  displayedProgressionStepIndexAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  resolvedProgressionStepsAtom,
} from "../../../store/progressionAtoms";
import { buildTimelineViewModel } from "./buildTimelineViewModel";

export function useTimelineViewModel() {
  const steps = useAtomValue(resolvedProgressionStepsAtom);
  const beatsPerBar = useAtomValue(beatsPerBarAtom);
  const activeStepIndex = useAtomValue(activeProgressionStepIndexAtom);
  const displayedStepIndex = useAtomValue(displayedProgressionStepIndexAtom);
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
    steps,
    activeStepIndex,
    displayedStepIndex,
    currentProgressionBar,
    canPlay,
    playing,
    transportStartBar,
    playbackBlockedReason,
  };
}
