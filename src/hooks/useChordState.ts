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
  hideNonChordNotesAtom,
} from "../store/atoms";

export function useChordState() {
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [practiceLens, setPracticeLens] = useAtom(practiceLensAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const hideNonChordNotes = useAtomValue(hideNonChordNotesAtom);

  const chordTones = useAtomValue(chordTonesAtom);
  const chordMembers = useAtomValue(chordMembersAtom);
  const hasOutsideChordMembers = useAtomValue(hasOutsideChordMembersAtom);
  const chordLabel = useAtomValue(chordLabelAtom);

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
    hideNonChordNotes,
    chordTones,
    chordMembers,
    hasOutsideChordMembers,
    chordLabel,
  };
}
