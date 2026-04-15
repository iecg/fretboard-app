import { useState } from "react";
import {
  useAtom,
  useAtomValue,
  useSetAtom,
} from "jotai";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  hideNonChordNotesAtom,
  chordFretSpreadAtom,
  chordIntervalFilterAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  fretStartAtom,
  fretEndAtom,
  displayFormatAtom,
  shapeLabelsAtom,
  tuningNameAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  setRootNoteAtom,
} from "../store/atoms";
import type { CagedShape } from "../shapes";

export default function useDisplayState() {
  // Scale
  const rootNote = useAtomValue(rootNoteAtom);
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);

  // Chord overlay
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [hideNonChordNotes, setHideNonChordNotes] = useAtom(hideNonChordNotesAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const [chordIntervalFilter, setChordIntervalFilter] = useAtom(chordIntervalFilterAtom);

  // Fingering
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);

  // Fret range (for auto-center calculation)
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);

  // Display
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [shapeLabels, setShapeLabels] = useAtom(shapeLabelsAtom);
  const tuningName = useAtomValue(tuningNameAtom);

  // Accidentals
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  // Root note setter (write atom for CoF root selection — syncs chordRoot when linked)
  const setRootNote = useSetAtom(setRootNoteAtom);

  // Internalized local state
  const [clickedShape, setClickedShape] = useState<CagedShape | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  // Callbacks
  const onShapeClick = (shape: CagedShape | null) => {
    setClickedShape(shape);
  };

  const onRecenter = () => {
    setRecenterKey((k) => k + 1);
  };

  return {
    // Values
    rootNote,
    scaleName,
    chordRoot,
    chordType,
    linkChordRoot,
    hideNonChordNotes,
    chordFretSpread,
    chordIntervalFilter,
    fingeringPattern,
    cagedShapes,
    npsPosition,
    startFret,
    endFret,
    displayFormat,
    shapeLabels,
    tuningName,
    accidentalMode,
    enharmonicDisplay,
    // Setters
    setScaleName,
    setChordRoot,
    setChordType,
    setLinkChordRoot,
    setHideNonChordNotes,
    setChordIntervalFilter,
    setFingeringPattern,
    setCagedShapes,
    setNpsPosition,
    setDisplayFormat,
    setShapeLabels,
    setRootNote,
    // Internal state + callbacks
    clickedShape,
    recenterKey,
    onShapeClick,
    onRecenter,
  };
}
