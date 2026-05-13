import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  practiceLensAtom,
  chordTonesAtom,
  chordMembersAtom,
  hasOutsideChordMembersAtom,
  chordLabelAtom,
  chordFretSpreadAtom,
  chordOverlayModeAtom,
  chordRootOverrideAtom,
  effectiveChordDegreeAtom,
  effectiveChordOverlayModeAtom,
  effectiveChordQualityOverrideAtom,
  setChordDegreeAtom,
} from "../store/atoms";

export function useChordState() {
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [practiceLens, setPracticeLens] = useAtom(practiceLensAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);

  const chordTones = useAtomValue(chordTonesAtom);
  const chordMembers = useAtomValue(chordMembersAtom);
  const hasOutsideChordMembers = useAtomValue(hasOutsideChordMembersAtom);
  const chordLabel = useAtomValue(chordLabelAtom);

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
    linkChordRoot,
    setLinkChordRoot,
    practiceLens,
    setPracticeLens,
    chordFretSpread,
    chordTones,
    chordMembers,
    hasOutsideChordMembers,
    chordLabel,
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
