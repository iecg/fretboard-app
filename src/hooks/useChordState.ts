import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { chordRootAtom, chordTypeAtom, linkChordRootAtom, practiceLensAtom, chordTonesAtom, chordMembersAtom, chordLabelAtom, chordFretSpreadAtom, chordOverlayModeAtom, chordRootOverrideAtom, effectiveChordDegreeAtom, effectiveChordOverlayModeAtom, effectiveChordQualityOverrideAtom, fullChordsEnabledAtom, fullChordMatchesAtom, fullChordPositionsAtom, setChordDegreeAtom } from "../store/chordOverlayAtoms";
import { hasOutsideChordMembersAtom } from "../store/composableSelectors";
import { currentTuningAtom } from "../store/layoutAtoms";

export function useChordState() {
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const currentTuning = useAtomValue(currentTuningAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [practiceLens, setPracticeLens] = useAtom(practiceLensAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const [fullChordsEnabled, setFullChordsEnabled] = useAtom(fullChordsEnabledAtom);

  const chordTones = useAtomValue(chordTonesAtom);
  const chordMembers = useAtomValue(chordMembersAtom);
  const hasOutsideChordMembers = useAtomValue(hasOutsideChordMembersAtom);
  const chordLabel = useAtomValue(chordLabelAtom);
  const fullChordMatches = useAtomValue(fullChordMatchesAtom);
  const fullChordPositions = useAtomValue(fullChordPositionsAtom);

  const chordDegree = useAtomValue(effectiveChordDegreeAtom);
  // Use the action wrapper so that picking a new degree clears any chord-quality
  // override — each degree starts at its diatonic default.
  const setChordDegree = useSetAtom(setChordDegreeAtom);
  const chordOverlayMode = useAtomValue(effectiveChordOverlayModeAtom);
  const setChordOverlayMode = useSetAtom(chordOverlayModeAtom);
  const [chordRootOverride, setChordRootOverride] = useAtom(chordRootOverrideAtom);
  const chordQualityOverride = useAtomValue(effectiveChordQualityOverrideAtom);
  const setChordQualityOverride = useSetAtom(chordTypeAtom);

  return {
    chordRoot,
    setChordRoot,
    chordType,
    setChordType,
    currentTuning,
    linkChordRoot,
    setLinkChordRoot,
    practiceLens,
    setPracticeLens,
    chordFretSpread,
    fullChordsEnabled,
    setFullChordsEnabled,
    chordTones,
    chordMembers,
    hasOutsideChordMembers,
    chordLabel,
    fullChordMatches,
    fullChordPositions,
    chordDegree,
    setChordDegree,
    chordOverlayMode,
    setChordOverlayMode,
    chordRootOverride,
    setChordRootOverride,
    chordQualityOverride,
    setChordQualityOverride,
  };
}
