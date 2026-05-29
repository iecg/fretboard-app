import { useDeferredValue, useMemo } from "react";
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
  // The frame atom is written synchronously every rAF tick by the visual clock.
  // Defer it here (React-provided hook) so the expensive per-frame fretboard
  // playhead render is deprioritized under load and can drop frames gracefully,
  // without wrapping the external-store write in startTransition.
  const frame = useDeferredValue(useAtomValue(progressionVisualFrameAtom));
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
