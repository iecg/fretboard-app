import { useEffect, useState } from "react";
import { useAtomValue, useStore } from "jotai";
import { useDeferredValue } from "react";
import { progressionPlayingAtom, displayedStepIndexPrimitiveAtom } from "../../../store/progressionAtoms";
import { activeStepDurationBeatsAtom } from "../../../store/practiceLensAtoms";
import { progressionVisualFrameAtom } from "../../../store/progressionVisualAtoms";
import { getTimelinePosition } from "../../../progressions/audio/timeline";

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
  const stepDurationBeats = useAtomValue(activeStepDurationBeatsAtom);
  const store = useStore();
  const [snapshot, setSnapshot] = useState<FretboardPlaybackSnapshot | null>(null);

  useEffect(() => {
    if (!enabled || !playing) return;

    let rafId: number;
    let lastStepIndex = -1;

    const loop = () => {
      const tl = getTimelinePosition();
      if (tl) {
        setSnapshot({
          playing: true,
          activeStepIndex: tl.stepIndex,
          globalFraction: tl.globalFraction,
          localFraction: tl.localFraction,
          stepDurationBeats,
        });
        store.set(progressionVisualFrameAtom, tl);
        if (!tl.paused && tl.stepIndex !== lastStepIndex) {
          lastStepIndex = tl.stepIndex;
          store.set(displayedStepIndexPrimitiveAtom, tl.stepIndex);
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      store.set(progressionVisualFrameAtom, null);
    };
  }, [enabled, playing, stepDurationBeats, store]);

  return useDeferredValue(enabled && playing ? snapshot : null);
}
