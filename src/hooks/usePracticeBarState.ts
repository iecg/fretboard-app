import { useAtomValue } from "jotai";
import {
  showChordPracticeBarAtom,
  practiceBarTitleAtom,
  practiceBarBadgeAtom,
  practiceBarColorNotesAtom,
  allChordMembersAtom,
  practiceBarColorNotesFilteredAtom,
  isShapeLocalContextAtom,
  shapeContextLabelAtom,
  shapeLocalTargetMembersAtom,
  shapeLocalOutsideMembersAtom,
  shapeLocalColorNotesFilteredAtom,
  shapeHighlightedNoteSetAtom,
  viewModeAtom,
} from "../store/atoms";

export function usePracticeBarState() {
  const showChordPracticeBar = useAtomValue(showChordPracticeBarAtom);
  const practiceBarTitle = useAtomValue(practiceBarTitleAtom);
  const practiceBarBadge = useAtomValue(practiceBarBadgeAtom);
  const practiceBarColorNotes = useAtomValue(practiceBarColorNotesAtom);
  const allChordMembers = useAtomValue(allChordMembersAtom);
  const practiceBarColorNotesFiltered = useAtomValue(
    practiceBarColorNotesFilteredAtom,
  );
  const isShapeLocalContext = useAtomValue(isShapeLocalContextAtom);
  const shapeContextLabel = useAtomValue(shapeContextLabelAtom);
  const shapeLocalTargetMembers = useAtomValue(shapeLocalTargetMembersAtom);
  const shapeLocalOutsideMembers = useAtomValue(shapeLocalOutsideMembersAtom);
  const shapeLocalColorNotesFiltered = useAtomValue(
    shapeLocalColorNotesFilteredAtom,
  );
  const shapeHighlightedNoteSet = useAtomValue(shapeHighlightedNoteSetAtom);
  const viewMode = useAtomValue(viewModeAtom);

  const shapeLocalColorNotes = practiceBarColorNotes.filter(
    (n) => shapeHighlightedNoteSet?.has(n.internalNote),
  );

  return {
    showChordPracticeBar,
    practiceBarTitle,
    practiceBarBadge,
    practiceBarColorNotes,
    allChordMembers,
    practiceBarColorNotesFiltered,
    isShapeLocalContext,
    shapeContextLabel,
    shapeLocalTargetMembers,
    shapeLocalOutsideMembers,
    shapeLocalColorNotesFiltered,
    shapeLocalColorNotes,
    viewMode,
  };
}
