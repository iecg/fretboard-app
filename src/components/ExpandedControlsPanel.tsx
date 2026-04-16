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
  fretStartAtom,
  fretEndAtom,
} from "../store/atoms";
import { resolveAccidentalMode } from "../theory";
import { FingeringPatternControls } from "./FingeringPatternControls";
import { FretRangeControl } from "./FretRangeControl";
import { TheoryControls } from "./TheoryControls";
import { CircleOfFifths } from "../CircleOfFifths";
import { Card } from "./Card";

const END_FRET = 24;

/**
 * Renders the Configuration card: FingeringPatternControls + fret range.
 */
export function BaseControlsSection() {
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);
  const [shapeLabels, setShapeLabels] = useAtom(shapeLabelsAtom);
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);

  return (
    <Card title="Configuration" className="dashboard-card dashboard-card--configuration">
      <div className="control-group">
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
        <FretRangeControl
          startFret={fretStart}
          endFret={fretEnd}
          onStartChange={setFretStart}
          onEndChange={setFretEnd}
          maxFret={END_FRET}
          layout="mobile"
          showLabels
        />
      </div>
    </Card>
  );
}

/**
 * Renders the Music Theory card.
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
    <Card title="Music Theory" className="dashboard-card dashboard-card--theory">
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
    </Card>
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
    <Card title="Key Explorer" className="dashboard-card key-column">
      <CircleOfFifths
        rootNote={rootNote}
        setRootNote={handleSetRootNote}
        scaleName={scaleName}
        useFlats={useFlats}
        enharmonicDisplay={enharmonicDisplay}
      />
    </Card>
  );
}

/**
 * Shared non-mobile controls layout. Split mode stacks Settings + Scale/Chord
 * on the left with Key on the right. Stacked mode renders all three groups in
 * a single column for compact-height tablet and desktop viewports.
 */
export function ExpandedControlsPanel({
  mode,
}: {
  mode: "3col" | "split" | "stacked";
}) {
  return (
    <div className="controls-panel controls-panel--dashboard" data-mode={mode}>
      <BaseControlsSection />
      <ScaleChordSection />
      <KeyColumn />
    </div>
  );
}
