import { useMemo } from "react";
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
  const playing = useAtomValue(progressionPlayingAtom);
  const frame = useAtomValue(progressionVisualFrameAtom);
  const stepDurationBeats = useAtomValue(activeStepDurationBeatsAtom);
  const commonWithNext = useAtomValue(commonTonesWithNextAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);

  return useMemo(() => {
    if (!playing || !frame) return null;
    return {
      playing,
      activeStepIndex: frame.stepIndex,
      globalFraction: frame.globalFraction,
      localFraction: frame.localFraction,
      stepDurationBeats,
      beatPosition: frame.localFraction * stepDurationBeats,
      commonWithNext: practiceLens === "lead" ? commonWithNext : EMPTY_SET,
      nextGuideTones: practiceLens === "lead" ? nextGuideTones : EMPTY_SET,
    };
  }, [playing, frame, stepDurationBeats, practiceLens, commonWithNext, nextGuideTones]);
}
