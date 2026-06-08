import { useAtomValue } from "jotai";
import {
  nextChordGuideTonesAtom,
  nextChordGuideToneLabelsAtom,
  nextChordTonesAtom,
  incomingTonesAtom,
  departingTonesAtom,
  guideCountdownActiveAtom,
  guideCountdownTickFractionsAtom,
  commonTonesWithNextAtom,
  practiceLensAtom,
  type PracticeLens,
} from "../../../store/practiceLensAtoms";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";

export interface EmphasisContext {
  nextGuideTones: Set<string>;
  nextGuideToneLabels: Map<string, string>;
  nextChordTones: Set<string>;
  incomingTones: Set<string>;
  departingTones: Set<string>;
  guideCountdownActive: boolean;
  countdownTicks: number[];
  lens: PracticeLens;
  commonTones: Set<string>;
}

/**
 * Frame-stable emphasis context. Every field changes only at a step boundary
 * or the lead-in threshold — never per animation frame — so note emphasis
 * recomputes at most twice per step.
 */
export function useEmphasisContext(enabled: boolean): EmphasisContext | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const guideCountdownActive = useAtomValue(guideCountdownActiveAtom);
  const countdownTicks = useAtomValue(guideCountdownTickFractionsAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);
  const nextGuideToneLabels = useAtomValue(nextChordGuideToneLabelsAtom);
  const nextChordTones = useAtomValue(nextChordTonesAtom);
  const incomingTones = useAtomValue(incomingTonesAtom);
  const departingTones = useAtomValue(departingTonesAtom);
  const lens = useAtomValue(practiceLensAtom);
  const commonTones = useAtomValue(commonTonesWithNextAtom);
  if (!enabled || !playing) return null;
  return {
    nextGuideTones,
    nextGuideToneLabels,
    nextChordTones,
    incomingTones,
    departingTones,
    guideCountdownActive,
    countdownTicks,
    lens,
    commonTones,
  };
}
