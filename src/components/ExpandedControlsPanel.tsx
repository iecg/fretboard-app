import { useMemo } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import {
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  shapeLabelsAtom,
  displayFormatAtom,
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  hideNonChordNotesAtom,
  chordIntervalFilterAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
} from "../store/atoms";
import { resolveAccidentalMode } from "../theory";
import { FingeringPatternControls } from "./FingeringPatternControls";
import { TheoryControls } from "./TheoryControls";
import { CircleOfFifths } from "../CircleOfFifths";

/**
 * Renders the left-most base controls: FingeringPatternControls.
 */
export function BaseControlsSection() {
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);
  const [shapeLabels, setShapeLabels] = useAtom(shapeLabelsAtom);
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);

  return (
    <div className="control-group panel-surface controls-card controls-card--base">
      <FingeringPatternControls
        fingeringPattern={fingeringPattern}
        setFingeringPattern={setFingeringPattern}
        cagedShapes={cagedShapes}
        setCagedShapes={setCagedShapes}
        npsPosition={npsPosition}
        setNpsPosition={setNpsPosition}
        shapeLabels={shapeLabels}
        setShapeLabels={setShapeLabels}
        displayFormat={displayFormat}
        setDisplayFormat={setDisplayFormat}
      />
    </div>
  );
}

/**
 * Renders the Scale & Chord column.
 */
export function ScaleChordSection() {
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);
  const [scaleBrowseMode, setScaleBrowseMode] = useAtom(scaleBrowseModeAtom);
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [hideNonChordNotes, setHideNonChordNotes] = useAtom(
    hideNonChordNotesAtom,
  );
  const [chordIntervalFilter, setChordIntervalFilter] = useAtom(
    chordIntervalFilterAtom,
  );
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const useFlats = useMemo(
    () => resolveAccidentalMode(rootNote, scaleName, accidentalMode),
    [rootNote, scaleName, accidentalMode],
  );

  return (
    <div className="control-group panel-surface controls-card controls-card--scale">
      <h2>Theory</h2>
      <TheoryControls
        rootNote={rootNote}
        setRootNote={setRootNote}
        scaleName={scaleName}
        setScaleName={setScaleName}
        scaleBrowseMode={scaleBrowseMode}
        setScaleBrowseMode={setScaleBrowseMode}
        chordType={chordType}
        setChordType={setChordType}
        chordRoot={chordRoot}
        setChordRoot={setChordRoot}
        linkChordRoot={linkChordRoot}
        setLinkChordRoot={setLinkChordRoot}
        hideNonChordNotes={hideNonChordNotes}
        setHideNonChordNotes={setHideNonChordNotes}
        chordIntervalFilter={chordIntervalFilter}
        setChordIntervalFilter={setChordIntervalFilter}
        useFlats={useFlats}
      />
    </div>
  );
}

/**
 * Renders the key column: CircleOfFifths with heading.
 * Reads all required state from Jotai atoms directly.
 */
export function KeyColumn() {
  const rootNote = useAtomValue(rootNoteAtom);
  const handleSetRootNote = useSetAtom(setRootNoteAtom);
  const [scaleName] = useAtom(scaleNameAtom);
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const useFlats = useMemo(
    () => resolveAccidentalMode(rootNote, scaleName, accidentalMode),
    [rootNote, scaleName, accidentalMode],
  );
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  return (
    <div className="control-group key-column panel-surface controls-card controls-card--key">
      <h2>Key Explorer</h2>
      <CircleOfFifths
        rootNote={rootNote}
        setRootNote={handleSetRootNote}
        scaleName={scaleName}
        useFlats={useFlats}
        enharmonicDisplay={enharmonicDisplay}
      />
    </div>
  );
}

/**
 * Shared non-mobile controls layout. Split mode stacks Settings + Scale/Chord
 * on the left with Key on the right. Stacked mode renders all three groups in
 * a single column for compact-height tablet and desktop viewports.
 */
export function ExpandedControlsPanel({ mode }: { mode: "split" | "stacked" }) {
  if (mode === "stacked") {
    return (
      <div className="controls-panel controls-panel--stacked">
        <BaseControlsSection />
        <ScaleChordSection />
        <KeyColumn />
      </div>
    );
  }

  return (
    <div className="controls-panel controls-panel--split">
      <div className="controls-panel-column">
        <BaseControlsSection />
        <ScaleChordSection />
      </div>
      <KeyColumn />
    </div>
  );
}
