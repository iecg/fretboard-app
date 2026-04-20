import { useAtomValue } from "jotai";
import {
  showChordPracticeBarAtom,
  practiceBarTitleAtom,
  practiceBarBadgeAtom,
  practiceBarLensLabelAtom,
  practiceLensAtom,
  practiceBarChordGroupAtom,
  practiceBarLandOnGroupAtom,
} from "../store/atoms";

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
