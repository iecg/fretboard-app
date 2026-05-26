import { useMemo } from "react";
import { atom } from "jotai";
import { useAtomValue } from "jotai";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";
import {
  activeStepDurationBeatsAtom,
  commonTonesWithNextAtom,
  nextChordGuideTonesAtom,
} from "../../../store/practiceLensAtoms";
import { progressionVisualFrameAtom } from "../../../store/progressionVisualAtoms";
import type { PracticeLens } from "@fretflow/core";

const EMPTY_SET = new Set<string>();

export interface FretboardPlaybackSnapshot {
  playing: boolean;
  activeStepIndex: number;
  globalFraction: number;
  localFraction: number;
  stepDurationBeats: number;
  beatPosition: number;
  commonWithNext: Set<string>;
  nextGuideTones: Set<string>;
}

export function useFretboardPlaybackSnapshot(
  practiceLens?: PracticeLens,
): FretboardPlaybackSnapshot | null {
  const commonWithNextForLensAtom = useMemo(
    () =>
      atom((get) =>
        practiceLens === "lead" ? get(commonTonesWithNextAtom) : EMPTY_SET,
      ),
    [practiceLens],
  );

  const nextGuideTonesForLensAtom = useMemo(
    () =>
      atom((get) =>
        practiceLens === "lead" ? get(nextChordGuideTonesAtom) : EMPTY_SET,
      ),
    [practiceLens],
  );

  const playing = useAtomValue(progressionPlayingAtom);
  const frame = useAtomValue(progressionVisualFrameAtom);
  const stepDurationBeats = useAtomValue(activeStepDurationBeatsAtom);
  const commonWithNext = useAtomValue(commonWithNextForLensAtom);
  const nextGuideTones = useAtomValue(nextGuideTonesForLensAtom);

  return useMemo(() => {
    if (!playing || !frame) return null;
    return {
      playing,
      activeStepIndex: frame.stepIndex,
      globalFraction: frame.globalFraction,
      localFraction: frame.localFraction,
      stepDurationBeats,
      beatPosition: frame.localFraction * stepDurationBeats,
      commonWithNext,
      nextGuideTones,
    };
  }, [playing, frame, stepDurationBeats, commonWithNext, nextGuideTones]);
}
