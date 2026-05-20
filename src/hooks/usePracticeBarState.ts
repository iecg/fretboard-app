import { useAtomValue } from "jotai";
import { practiceLensAtom } from "../store/chordOverlayAtoms";
import { showChordPracticeBarAtom, practiceBarTitleAtom, practiceBarBadgeAtom, practiceBarLensLabelAtom, practiceBarChordGroupAtom, practiceBarLandOnGroupAtom } from "../store/practiceLensAtoms";

export function usePracticeBarState() {
  const showChordPracticeBar = useAtomValue(showChordPracticeBarAtom);
  const practiceBarTitle = useAtomValue(practiceBarTitleAtom);
  const practiceBarBadge = useAtomValue(practiceBarBadgeAtom);
  const practiceBarLensLabel = useAtomValue(practiceBarLensLabelAtom);
  const practiceLens = useAtomValue(practiceLensAtom);
  const chordGroup = useAtomValue(practiceBarChordGroupAtom);
  const landOnGroup = useAtomValue(practiceBarLandOnGroupAtom);

  return {
    showChordPracticeBar,
    practiceBarTitle,
    practiceBarBadge,
    practiceBarLensLabel,
    practiceLens,
    chordGroup,
    landOnGroup,
  };
}
