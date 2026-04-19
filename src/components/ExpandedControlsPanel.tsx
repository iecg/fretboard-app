import "./ExpandedControlsPanel.css";
import { useMemo } from "react";
import shared from "./shared.module.css";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import {
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  displayFormatAtom,
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  viewModeAtom,
  focusPresetAtom,
  customMembersAtom,
  enharmonicDisplayAtom,
  fretStartAtom,
  fretEndAtom,
  useFlatsAtom,
} from "../store/atoms";
import {
  NOTES,
  CHORD_DEFINITIONS,
  getScaleNotes,
  getChordNotes,
  getAvailableFocusPresets,
  type ViewMode,
  type FocusPreset,
  type ResolvedChordMember,
} from "../theory";
import { FingeringPatternControls } from "./FingeringPatternControls";
import { FretRangeControl } from "./FretRangeControl";
import { TheoryControls } from "./TheoryControls";
import { CircleOfFifths } from "../CircleOfFifths";
import { Card } from "./Card";
import { MAX_FRET } from "../constants";

/**
 * Renders the Configuration card: FingeringPatternControls + fret range.
 */
export function BaseControlsSection() {
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);

  return (
    <Card
      title="Configuration"
      className="dashboard-card dashboard-card--configuration"
    >
      <div className="control-group">
        <FingeringPatternControls
          fingeringPattern={fingeringPattern}
          setFingeringPattern={setFingeringPattern}
          cagedShapes={cagedShapes}
          setCagedShapes={setCagedShapes}
          npsPosition={npsPosition}
          setNpsPosition={setNpsPosition}
          displayFormat={displayFormat}
          setDisplayFormat={setDisplayFormat}
        />
        <div className={shared["control-section"]}>
          <span className={shared["section-label"]}>Fret Range</span>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="dashboard"
          />
        </div>
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
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [focusPreset, setFocusPreset] = useAtom(focusPresetAtom);
  const [customMembers, setCustomMembers] = useAtom(customMembersAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const useFlats = useAtomValue(useFlatsAtom);

  const availableFocusPresets = useMemo((): FocusPreset[] => {
    if (!chordType) return ["all", "custom"];
    return getAvailableFocusPresets(chordType);
  }, [chordType]);

  const chordMembers = useMemo((): ResolvedChordMember[] => {
    if (!chordType) return [];
    const def = CHORD_DEFINITIONS[chordType];
    if (!def) return [];
    const rootIndex = NOTES.indexOf(chordRoot);
    if (rootIndex === -1) return [];
    return def.members.map((m) => ({
      ...m,
      note: NOTES[(rootIndex + m.semitone) % 12],
    }));
  }, [chordRoot, chordType]);

  const hasOutsideChordMembers = useMemo(() => {
    if (!chordType) return false;
    const chordTones = getChordNotes(chordRoot, chordType);
    if (chordTones.length === 0) return false;
    const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
    return chordTones.some((note) => !scaleNoteSet.has(note));
  }, [chordType, chordRoot, rootNote, scaleName]);

  return (
    <Card
      title="Music Theory"
      className="dashboard-card dashboard-card--theory"
    >
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
        viewMode={viewMode as ViewMode}
        setViewMode={setViewMode}
        focusPreset={focusPreset as FocusPreset}
        setFocusPreset={setFocusPreset}
        customMembers={customMembers}
        setCustomMembers={setCustomMembers}
        availableFocusPresets={availableFocusPresets}
        chordMembers={chordMembers}
        hasOutsideChordMembers={hasOutsideChordMembers}
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
  const useFlats = useAtomValue(useFlatsAtom);
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
