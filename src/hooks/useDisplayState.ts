import { useAtom, useAtomValue } from "jotai";
import {
  accidentalModeAtom,
  enharmonicDisplayAtom,
  chordFretSpreadAtom,
  hideNonChordNotesAtom,
  displayFormatAtom,
  noteRoleMapAtom,
  summaryChordRowAtom,
  summaryLegendItemsAtom,
  chordMemberLabelsAtom,
  summaryHeaderLeftAtom,
  summaryHeaderRightAtom,
  summaryPrimaryModeAtom,
  showRelationshipRowAtom,
  sharedChordMembersAtom,
  outsideChordMembersAtom,
  summaryNotesAtom,
  chordLabelAtom,
  chordSummaryNotesAtom,
} from "../store/atoms";
import {
  type ViewMode,
  type FocusPreset,
  type ChordMemberName,
  type ResolvedChordMember,
  type NoteRole,
  type ChordRowEntry,
  type LegendItem,
  type PracticeBarColorNote,
} from "../theory";
import { useScaleState } from "./useScaleState";
import { useChordState } from "./useChordState";
import { useShapeState } from "./useShapeState";
import { usePracticeBarState } from "./usePracticeBarState";
import { useFretboardState } from "./useFretboardState";

export type {
  ViewMode,
  FocusPreset,
  ChordMemberName,
  ResolvedChordMember,
  NoteRole,
  ChordRowEntry,
  LegendItem,
  PracticeBarColorNote,
};

export default function useDisplayState() {
  const scaleState = useScaleState();
  const chordState = useChordState();
  const shapeState = useShapeState();
  const practiceBarState = usePracticeBarState();
  const fretboardState = useFretboardState();

  // Atom values not covered by domain hooks yet
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const hideNonChordNotes = useAtomValue(hideNonChordNotesAtom);

  // Derived values from atoms
  const noteRoleMap = useAtomValue(noteRoleMapAtom);
  const summaryChordRow = useAtomValue(summaryChordRowAtom);
  const summaryLegendItems = useAtomValue(summaryLegendItemsAtom);
  const chordMemberLabels = useAtomValue(chordMemberLabelsAtom);
  const summaryHeaderLeft = useAtomValue(summaryHeaderLeftAtom);
  const summaryHeaderRight = useAtomValue(summaryHeaderRightAtom);
  const summaryPrimaryMode = useAtomValue(summaryPrimaryModeAtom);
  const showRelationshipRow = useAtomValue(showRelationshipRowAtom);
  const sharedChordMembers = useAtomValue(sharedChordMembersAtom);
  const outsideChordMembers = useAtomValue(outsideChordMembersAtom);
  const summaryNotes = useAtomValue(summaryNotesAtom);
  const chordLabel = useAtomValue(chordLabelAtom);
  const chordSummaryNotes = useAtomValue(chordSummaryNotesAtom);

  // Compatibility aliases
  const showSecondaryChordRail = showRelationshipRow;
  const practiceBarSharedMembers = practiceBarState.allChordMembers.filter(
    (e) => e.inScale,
  );
  const practiceBarOutsideMembers = practiceBarState.allChordMembers.filter(
    (e) => !e.inScale,
  );
  const practiceBarTargetMembers = practiceBarState.allChordMembers;

  return {
    ...scaleState,
    ...chordState,
    ...shapeState,
    ...practiceBarState,
    ...fretboardState,
    // Overrides/Additional values
    accidentalMode,
    enharmonicDisplay,
    displayFormat,
    setDisplayFormat,
    chordFretSpread,
    hideNonChordNotes,
    noteRoleMap,
    summaryChordRow,
    summaryLegendItems,
    chordMemberLabels,
    summaryHeaderLeft,
    summaryHeaderRight,
    summaryPrimaryMode,
    showRelationshipRow,
    showSecondaryChordRail,
    sharedChordMembers,
    outsideChordMembers,
    summaryNotes,
    chordLabel,
    chordSummaryNotes,
    practiceBarSharedMembers,
    practiceBarOutsideMembers,
    practiceBarTargetMembers,
  };
}
