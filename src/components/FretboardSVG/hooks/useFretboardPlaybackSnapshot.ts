import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";
import { activeStepDurationBeatsAtom } from "../../../store/practiceLensAtoms";
import { progressionVisualFrameAtom } from "../../../store/progressionVisualAtoms";

export interface FretboardPlaybackSnapshot {
  playing: boolean;
  activeStepIndex: number;
  globalFraction: number;
  localFraction: number;
  stepDurationBeats: number;
}

export function useFretboardPlaybackSnapshot(
  enabled: boolean,
): FretboardPlaybackSnapshot | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const frame = useAtomValue(progressionVisualFrameAtom);
  const stepDurationBeats = useAtomValue(activeStepDurationBeatsAtom);

  return useMemo(() => {
    if (!enabled || !playing || !frame) return null;
    return {
      playing,
      activeStepIndex: frame.stepIndex,
      globalFraction: frame.globalFraction,
      localFraction: frame.localFraction,
      stepDurationBeats,
    };
  }, [enabled, playing, frame, stepDurationBeats]);
}
