import { useMemo, useCallback } from "react";
import {
  NOTES,
  SCALES,
  INTERVAL_NAMES,
  getNoteDisplayInScale,
  formatAccidental,
} from "../theory";
import { useScaleState } from "../hooks/useScaleState";
import { useChordState } from "../hooks/useChordState";
import { usePracticeBarState } from "../hooks/usePracticeBarState";
import { DegreeChipStrip } from "./DegreeChipStrip";
import { ChordPracticeBar } from "./ChordPracticeBar";

export function SummaryRibbon() {
  const {
    rootNote,
    scaleName,
    useFlats,
    scaleLabel,
    scaleNotes,
    hiddenNotes,
    setHiddenNotes,
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
  } = usePracticeBarState();

  const practiceBarOutsideMembers = useMemo(
    () => allChordMembers.filter((e) => !e.inScale),
    [allChordMembers],
  );

  const toggleHiddenNote = useCallback(
    (note: string) => {
      setHiddenNotes((prev) => {
        const next = new Set(prev);
        if (next.has(note)) next.delete(note);
        else next.add(note);
        return next;
      });
    },
    [setHiddenNotes],
  );

  const degreeChips = useMemo(() => {
    const rootIdx = NOTES.indexOf(rootNote);
    return scaleNotes.map((note) => {
      const noteIdx = NOTES.indexOf(note);
      const chromaticInterval =
        rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : 0;
      const interval = INTERVAL_NAMES[chromaticInterval] ?? "1";
      return {
        internalNote: note,
        note: formatAccidental(
          getNoteDisplayInScale(
            note,
            rootNote,
            SCALES[scaleName] || [],
            useFlats,
          ),
        ),
        interval: formatAccidental(interval),
        inScale: true,
        isTonic: note === rootNote,
      };
    });
  }, [scaleNotes, rootNote, scaleName, useFlats]);

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
