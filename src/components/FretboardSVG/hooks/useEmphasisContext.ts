import { useAtomValue } from "jotai";
import {
  nextChordGuideTonesAtom,
  nextChordGuideToneLabelsAtom,
  nextChordTonesAtom,
  incomingTonesAtom,
  departingTonesAtom,
  leadInActiveAtom,
  planningWindowActiveAtom,
} from "../../../store/practiceLensAtoms";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";

export interface EmphasisContext {
  nextGuideTones: Set<string>;
  nextGuideToneLabels: Map<string, string>;
  nextChordTones: Set<string>;
  incomingTones: Set<string>;
  departingTones: Set<string>;
  leadInActive: boolean;
  planningActive: boolean;
}

/**
 * Frame-stable emphasis context. Every field changes only at a step boundary
 * or the lead-in threshold — never per animation frame — so note emphasis
 * recomputes at most twice per step.
 */
export function useEmphasisContext(enabled: boolean): EmphasisContext | null {
  const playing = useAtomValue(progressionPlayingAtom);
  const leadInActive = useAtomValue(leadInActiveAtom);
  const planningActive = useAtomValue(planningWindowActiveAtom);
  const nextGuideTones = useAtomValue(nextChordGuideTonesAtom);
  const nextGuideToneLabels = useAtomValue(nextChordGuideToneLabelsAtom);
  const nextChordTones = useAtomValue(nextChordTonesAtom);
  const incomingTones = useAtomValue(incomingTonesAtom);
  const departingTones = useAtomValue(departingTonesAtom);
  if (!enabled || !playing) return null;
  return {
    nextGuideTones,
    nextGuideToneLabels,
    nextChordTones,
    incomingTones,
    departingTones,
    leadInActive,
    planningActive,
  };
}
