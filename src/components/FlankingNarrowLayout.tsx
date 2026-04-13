import { useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  landscapeNarrowTabAtom,
  type LandscapeNarrowTab,
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
import { ToggleBar } from "./ToggleBar";
import { FingeringPatternControls } from "./FingeringPatternControls";
import { ScaleChordControls } from "./ScaleChordControls";
import { DrawerSelector } from "../DrawerSelector";
import { CircleOfFifths } from "../CircleOfFifths";

const LANDSCAPE_NARROW_TAB_OPTIONS: Array<{
  value: LandscapeNarrowTab;
  label: string;
}> = [
  { value: "fretboard", label: "Fretboard" },
  { value: "scaleChord", label: "Scale & Chord" },
  { value: "key", label: "Key" },
];

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

interface FlankingNarrowLayoutProps {
  fretboardNode?: React.ReactNode;
}

export function FlankingNarrowLayout({
  fretboardNode,
}: FlankingNarrowLayoutProps) {
  const [activeTab, setActiveTab] = useAtom(landscapeNarrowTabAtom);

  // Atom reads — mirrors ExpandedControlsPanel pattern
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
  const [hideNonChordNotes, setHideNonChordNotes] = useAtom(
    hideNonChordNotesAtom,
  );
  const [chordIntervalFilter, setChordIntervalFilter] = useAtom(
    chordIntervalFilterAtom,
  );
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const useFlats = useMemo(
    () => resolveAccidentalMode(rootNote, scaleName, accidentalMode),
    [rootNote, scaleName, accidentalMode],
  );
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  return (
    <main className="flanking-row">
      <aside className="flanking-side-panel">
        <div className="flanking-tab-bar">
          <ToggleBar
            options={LANDSCAPE_NARROW_TAB_OPTIONS}
            value={activeTab}
            onChange={setActiveTab}
            variant="tabs"
          />
        </div>
        <div className="flanking-tab-content">
          {activeTab === "fretboard" && (
            <>
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
            </>
          )}
          {activeTab === "scaleChord" && (
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
          )}
          {activeTab === "key" && (
            <CircleOfFifths
              rootNote={rootNote}
              setRootNote={handleSetRootNote}
              scaleName={scaleName}
              useFlats={useFlats}
              enharmonicDisplay={enharmonicDisplay}
            />
          )}
        </div>
      </aside>
      <div className="fretboard-wrapper">{fretboardNode}</div>
    </main>
  );
}
