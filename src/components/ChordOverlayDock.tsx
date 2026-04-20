import { useAtomValue } from "jotai";
import { usePracticeBarState } from "../hooks/usePracticeBarState";
import { ChordPracticeBar } from "./ChordPracticeBar";
import { DegreeChipStrip } from "./DegreeChipStrip";
import { degreeChipsAtom, scaleLabelAtom, colorNotesAtom } from "../store/atoms";

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

  const degreeChips = useAtomValue(degreeChipsAtom);
  const scaleLabel = useAtomValue(scaleLabelAtom);
  const colorNotes = useAtomValue(colorNotesAtom);

  if (!showChordPracticeBar) return null;

  const colorNoteSet = colorNotes.length > 0 ? new Set(colorNotes) : undefined;

  return (
    <>
      <ChordPracticeBar
        title={practiceBarTitle}
        badge={practiceBarBadge}
        lensLabel={practiceBarLensLabel}
        cues={practiceCues}
        isShapeLocal={isShapeLocalContext}
        shapeContextLabel={shapeContextLabel}
        shapeLocalCues={shapeLocalPracticeCues}
      />
      <DegreeChipStrip
        scaleName={scaleLabel}
        chips={degreeChips}
        colorNotes={colorNoteSet}
        compact
        hideHeader={false}
        aria-label="Scale degrees"
      />
    </>
  );
}
