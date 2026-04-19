import { useScaleState } from "../hooks/useScaleState";
import { useChordState } from "../hooks/useChordState";
import { usePracticeBarState } from "../hooks/usePracticeBarState";
import { DegreeChipStrip } from "./DegreeChipStrip";
import { ChordPracticeBar } from "./ChordPracticeBar";

export function SummaryRibbon() {
  const {
    scaleLabel,
    hiddenNotes,
    toggleHiddenNote,
    degreeChips,
  } = useScaleState();

  const { chordType, viewMode } = useChordState();

  const {
    showChordPracticeBar,
    practiceBarTitle,
    practiceBarBadge,
    practiceBarColorNotesFiltered,
    isShapeLocalContext,
    shapeContextLabel,
    shapeLocalTargetMembers,
    shapeLocalOutsideMembers,
    shapeLocalColorNotesFiltered,
    allChordMembers,
    practiceBarOutsideMembers,
  } = usePracticeBarState();

  const scaleStrip = (
    <DegreeChipStrip
      scaleName={scaleLabel}
      chips={degreeChips}
      hiddenNotes={hiddenNotes}
      onChipToggle={toggleHiddenNote}
      aria-label="Scale degrees"
    />
  );

  if (!chordType) {
    return scaleStrip;
  }

  return (
    <div className="summary-ribbon">
      {scaleStrip}
      {showChordPracticeBar && (
        <ChordPracticeBar
          title={practiceBarTitle}
          badge={practiceBarBadge}
          viewMode={viewMode}
          targetMembers={allChordMembers}
          outsideMembers={practiceBarOutsideMembers}
          colorNoteEntries={practiceBarColorNotesFiltered}
          isShapeLocal={isShapeLocalContext}
          shapeContextLabel={shapeContextLabel}
          shapeLocalTargetMembers={shapeLocalTargetMembers}
          shapeLocalOutsideMembers={shapeLocalOutsideMembers}
          shapeLocalColorNoteEntries={shapeLocalColorNotesFiltered}
        />
      )}
    </div>
  );
}
