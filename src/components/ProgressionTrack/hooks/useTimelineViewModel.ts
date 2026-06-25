import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  activeProgressionStepIndexAtom,
  auditionDisplayIndexAtom,
  beatsPerBarAtom,
  currentProgressionBarAtom,
  fastDisplayedStepIndexPrimitiveAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  progressionStepsAtom,
  progressionStepAtomsAtom,
} from "@fretflow/fretboard/store/progressionAtoms";
import { buildTimelineViewModel } from "./buildTimelineViewModel";

export function useTimelineViewModel() {
  const steps = useAtomValue(progressionStepsAtom);
  const stepAtoms = useAtomValue(progressionStepAtomsAtom);
  const beatsPerBar = useAtomValue(beatsPerBarAtom);
  const activeStepIndex = useAtomValue(activeProgressionStepIndexAtom);
  const fastStepIndex = useAtomValue(fastDisplayedStepIndexPrimitiveAtom);
  const auditionIndex = useAtomValue(auditionDisplayIndexAtom);
  const currentProgressionBar = useAtomValue(currentProgressionBarAtom);
  const playbackBlockedReason = useAtomValue(progressionPlaybackBlockedReasonAtom);
  const playing = useAtomValue(progressionPlayingAtom);

  // An active audition wins: the block highlight follows the chord being
  // auditioned. During playback: use the fast (non-transition-wrapped) primitive
  // so the block highlight advances on the same frame the audio clock crosses
  // into a new step — no scheduler lag. When stopped/paused: fall back to the
  // logical editor selection so the active block follows whichever chord the
  // user has clicked on, not a stale 0 left behind by the visualClock reset.
  const displayedStepIndex =
    auditionIndex != null ? auditionIndex : playing ? fastStepIndex : activeStepIndex;

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
