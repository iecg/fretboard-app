import { useAtom, useAtomValue } from "jotai";
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
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordRootOverrideAtom,
  chordQualityOverrideAtom,
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

  const [chordDegree, setChordDegree] = useAtom(chordDegreeAtom);
  const [chordOverlayMode, setChordOverlayMode] = useAtom(chordOverlayModeAtom);
  const [chordRootOverride, setChordRootOverride] = useAtom(chordRootOverrideAtom);
  const [chordQualityOverride, setChordQualityOverride] = useAtom(chordQualityOverrideAtom);

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
