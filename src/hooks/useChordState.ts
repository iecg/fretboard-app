import { useAtom, useAtomValue } from "jotai";
import {
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  viewModeAtom,
  focusPresetAtom,
  customMembersAtom,
  chordTonesAtom,
  chordMembersAtom,
  activeChordMembersAtom,
  activeChordTonesAtom,
  hasOutsideChordMembersAtom,
  chordLabelAtom,
  availableFocusPresetsAtom,
  chordFretSpreadAtom,
  hideNonChordNotesAtom,
} from "../store/atoms";

export function useChordState() {
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [focusPreset, setFocusPreset] = useAtom(focusPresetAtom);
  const [customMembers, setCustomMembers] = useAtom(customMembersAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const hideNonChordNotes = useAtomValue(hideNonChordNotesAtom);

  const chordTones = useAtomValue(chordTonesAtom);
  const chordMembers = useAtomValue(chordMembersAtom);
  const activeChordMembers = useAtomValue(activeChordMembersAtom);
  const activeChordTones = useAtomValue(activeChordTonesAtom);
  const hasOutsideChordMembers = useAtomValue(hasOutsideChordMembersAtom);
  const chordLabel = useAtomValue(chordLabelAtom);
  const availableFocusPresets = useAtomValue(availableFocusPresetsAtom);

  return {
    chordRoot,
    setChordRoot,
    chordType,
    setChordType,
    linkChordRoot,
    setLinkChordRoot,
    viewMode,
    setViewMode,
    focusPreset,
    setFocusPreset,
    customMembers,
    setCustomMembers,
    chordFretSpread,
    hideNonChordNotes,
    chordTones,
    chordMembers,
    activeChordMembers,
    activeChordTones,
    hasOutsideChordMembers,
    chordLabel,
    availableFocusPresets,
  };
}
