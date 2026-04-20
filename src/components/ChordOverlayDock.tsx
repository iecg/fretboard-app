import { usePracticeBarState } from "../hooks/usePracticeBarState";
import { ChordPracticeBar } from "./ChordPracticeBar";

/** Independent chord practice dock — shows coaching cues for the active lens. */
export function ChordOverlayDock() {
  const {
    showChordPracticeBar,
    practiceBarTitle,
    practiceBarBadge,
    practiceBarLensLabel,
    isShapeLocalContext,
    shapeContextLabel,
    practiceCues,
    shapeLocalPracticeCues,
  } = usePracticeBarState();

  if (!showChordPracticeBar) return null;

  return (
    <ChordPracticeBar
      title={practiceBarTitle}
      badge={practiceBarBadge}
      lensLabel={practiceBarLensLabel}
      cues={practiceCues}
      isShapeLocal={isShapeLocalContext}
      shapeContextLabel={shapeContextLabel}
      shapeLocalCues={shapeLocalPracticeCues}
    />
  );
}
