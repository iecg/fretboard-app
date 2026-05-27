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

// Stable module-level atoms — no recreation across renders.
const leadCommonWithNextAtom = atom((get) => get(commonTonesWithNextAtom));
const leadNextGuideTonesAtom = atom((get) => get(nextChordGuideTonesAtom));
const emptyCommonWithNextAtom = atom(() => EMPTY_SET);
const emptyNextGuideTonesAtom = atom(() => EMPTY_SET);

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
  const commonWithNext = useAtomValue(
    practiceLens === "lead" ? leadCommonWithNextAtom : emptyCommonWithNextAtom,
  );
  const nextGuideTones = useAtomValue(
    practiceLens === "lead" ? leadNextGuideTonesAtom : emptyNextGuideTonesAtom,
  );

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
