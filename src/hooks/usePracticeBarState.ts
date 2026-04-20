import { useAtomValue } from "jotai";
import {
  showChordPracticeBarAtom,
  practiceBarTitleAtom,
  practiceBarBadgeAtom,
  practiceBarLensLabelAtom,
  isShapeLocalContextAtom,
  shapeContextLabelAtom,
  practiceLensAtom,
  practiceCuesAtom,
  shapeLocalPracticeCuesAtom,
} from "../store/atoms";

export function usePracticeBarState() {
  const showChordPracticeBar = useAtomValue(showChordPracticeBarAtom);
  const practiceBarTitle = useAtomValue(practiceBarTitleAtom);
  const practiceBarBadge = useAtomValue(practiceBarBadgeAtom);
  const practiceBarLensLabel = useAtomValue(practiceBarLensLabelAtom);
  const isShapeLocalContext = useAtomValue(isShapeLocalContextAtom);
  const shapeContextLabel = useAtomValue(shapeContextLabelAtom);
  const practiceLens = useAtomValue(practiceLensAtom);
  const practiceCues = useAtomValue(practiceCuesAtom);
  const shapeLocalPracticeCues = useAtomValue(shapeLocalPracticeCuesAtom);

  return {
    showChordPracticeBar,
    practiceBarTitle,
    practiceBarBadge,
    practiceBarLensLabel,
    isShapeLocalContext,
    shapeContextLabel,
    practiceLens,
    practiceCues,
    shapeLocalPracticeCues,
  };
}
