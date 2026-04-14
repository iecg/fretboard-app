import { useMemo } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import {
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  tuningNameAtom,
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
import { TUNINGS } from "../guitar";
import { FingeringPatternControls } from "./FingeringPatternControls";
import { ScaleChordControls } from "./ScaleChordControls";
import { DrawerSelector } from "../DrawerSelector";
import { CircleOfFifths } from "../CircleOfFifths";

const CHORD_FILTER_OPTIONS = [
  "All",
  "Triad",
  "7th Chord",
  "Power Chord",
  "Guide Tones",
  "Shell Voicing",
  "Root & 3rd",
  "Root & 5th",
  "Root & 7th",
  "3rd & 5th",
  "3rd & 7th",
];

const SCALE_OPTIONS: (string | { divider: string })[] = [
  { divider: "Major Modes" },
  "Major",
  "Lydian",
  "Mixolydian",
  { divider: "Minor Modes" },
  "Natural Minor",
  "Dorian",
  "Phrygian",
  "Locrian",
  { divider: "Harmonic" },
  "Harmonic Minor",
  { divider: "Pentatonic" },
  "Minor Pentatonic",
  "Major Pentatonic",
  { divider: "Blues" },
  "Minor Blues",
  "Major Blues",
];

const CHORD_OPTIONS: (string | { divider: string })[] = [
  { divider: "Triads" },
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  { divider: "Seventh Chords" },
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  { divider: "Other" },
  "Power Chord (5)",
];

/**
 * Renders the left-most base controls: FingeringPatternControls + Tuning.
 */
export function BaseControlsSection() {
  const [tuningName, setTuningName] = useAtom(tuningNameAtom);
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

      <DrawerSelector
        label="Tuning"
        value={tuningName}
        options={Object.keys(TUNINGS)}
        onSelect={setTuningName}
      />
    </div>
  );
}

/**
 * Renders the Scale & Chord column.
 */
export function ScaleChordSection() {
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);
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
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const useFlats = useMemo(
    () => resolveAccidentalMode(rootNote, scaleName, accidentalMode),
    [rootNote, scaleName, accidentalMode],
  );

  return (
    <div className="control-group panel-surface controls-card controls-card--scale">
      <h2>Scale &amp; Chord</h2>
      <ScaleChordControls
        scaleName={scaleName}
        setScaleName={setScaleName}
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
        rootNote={rootNote}
        useFlats={useFlats}
        scaleOptions={SCALE_OPTIONS}
        chordOptions={CHORD_OPTIONS}
        chordFilterOptions={CHORD_FILTER_OPTIONS}
      />
    </div>
  );
}

/**
 * Extracted from ExpandedControlsPanel for reuse in flanking layouts (Phase 03).
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
      <h2>Key</h2>
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
