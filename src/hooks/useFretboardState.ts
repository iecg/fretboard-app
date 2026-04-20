import { useAtomValue } from "jotai";
import {
  currentTuningAtom,
  rootNoteAtom,
  scaleNameAtom,
  fretStartAtom,
  fretEndAtom,
  displayFormatAtom,
  useFlatsAtom,
  noteSemanticMapAtom,
  effectiveShapeDataAtom,
  autoCenterTargetAtom,
  recenterKeyAtom,
  chordTonesAtom,
  chordRootAtom,
  chordFretSpreadAtom,
  hideNonChordNotesAtom,
  practiceLensAtom,
  effectiveColorNotesAtom,
  effectiveHiddenNotesAtom,
} from "../store/atoms";

export function useFretboardState() {
  const currentTuning = useAtomValue(currentTuningAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);
  const displayFormat = useAtomValue(displayFormatAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const noteSemanticMap = useAtomValue(noteSemanticMapAtom);
  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } =
    useAtomValue(effectiveShapeDataAtom);
  const autoCenterTarget = useAtomValue(autoCenterTargetAtom);
  const recenterKey = useAtomValue(recenterKeyAtom);

  const chordTones = useAtomValue(chordTonesAtom);
  const chordRoot = useAtomValue(chordRootAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const hideNonChordNotes = useAtomValue(hideNonChordNotesAtom);
  const practiceLens = useAtomValue(practiceLensAtom);
  const colorNotes = useAtomValue(effectiveColorNotesAtom);
  const hiddenNotes = useAtomValue(effectiveHiddenNotesAtom);

  return {
    currentTuning,
    rootNote,
    scaleName,
    startFret,
    endFret,
    displayFormat,
    useFlats,
    noteSemanticMap,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    recenterKey,
    chordTones,
    chordRoot,
    chordFretSpread,
    hideNonChordNotes,
    practiceLens,
    colorNotes,
    hiddenNotes,
  };
}
