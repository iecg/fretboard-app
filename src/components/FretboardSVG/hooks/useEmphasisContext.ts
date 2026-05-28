import { useAtomValue } from "jotai";
import {
  anticipationActiveAtom,
  commonTonesWithNextAtom,
  nextChordGuideTonesAtom,
} from "../../../store/practiceLensAtoms";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";

export interface EmphasisContext {
  commonWithNext: Set<string>;
  nextGuideTones: Set<string>;
  anticipationActive: boolean;
}

/**
 * Frame-stable emphasis context. Every field changes only at a step boundary
 * or the anticipation threshold — never per animation frame — so note emphasis
 * recomputes at most twice per step.
 */
export function useEmphasisContext(enabled: boolean): EmphasisContext | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const anticipationActive = useAtomValue(anticipationActiveAtom);
  const commonWithNext = useAtomValue(commonTonesWithNextAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);
  if (!enabled || !playing) return null;
  return { commonWithNext, nextGuideTones, anticipationActive };
}
