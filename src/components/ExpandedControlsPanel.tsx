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
  useFlatsAtom,
} from "../store/atoms";
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
 * Target A "desktop-expanded" layout: 2-column grid where Settings and
 * Scale & Chord stack in the left column and Key/CoF spans both rows
 * on the right. Used when the viewport has enough vertical room to
 * show every control group fully expanded without tabs.
 *
 * The grid layout itself is driven by `.app-container[data-layout-mode=
 * "desktop-expanded"] .controls-panel` rules in App.css.
 */
export function ExpandedControlsPanel() {
  const rootNote = useAtomValue(rootNoteAtom);
  const handleSetRootNote = useSetAtom(setRootNoteAtom);
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);
  const [tuningName, setTuningName] = useAtom(tuningNameAtom);
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);
  const [shapeLabels, setShapeLabels] = useAtom(shapeLabelsAtom);
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [hideNonChordNotes, setHideNonChordNotes] = useAtom(hideNonChordNotesAtom);
  const [chordIntervalFilter, setChordIntervalFilter] = useAtom(chordIntervalFilterAtom);
  const useFlats = useAtomValue(useFlatsAtom);

  return (
    <div className="controls-panel">
      <div className="controls-col-left">
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

          <DrawerSelector
            label="Tuning"
            value={tuningName}
            options={Object.keys(TUNINGS)}
            onSelect={(v) => v && setTuningName(v)}
          />
        </div>

        <div className="control-group">
          <h2>Scale & Chord</h2>
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
      </div>

      <div className="control-group col-span-2 key-column">
        <h2>Key</h2>
        <CircleOfFifths
          rootNote={rootNote}
          setRootNote={handleSetRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
        />
      </div>
    </div>
  );
}
