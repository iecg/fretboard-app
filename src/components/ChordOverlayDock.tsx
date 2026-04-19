import { usePracticeBarState } from "../hooks/usePracticeBarState";
import { ChordPracticeBar } from "./ChordPracticeBar";

/** Chord overlay surface: practice bar when a chord with outside members is active. */
export function ChordOverlayDock() {
  const {
    showChordPracticeBar,
    practiceBarTitle,
    practiceBarBadge,
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
      cues={practiceCues}
      isShapeLocal={isShapeLocalContext}
      shapeContextLabel={shapeContextLabel}
      shapeLocalCues={shapeLocalPracticeCues}
    />
  );
}
