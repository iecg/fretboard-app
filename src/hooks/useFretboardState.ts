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
  shapeDataAtom,
  autoCenterTargetAtom,
  recenterKeyAtom,
  activeChordTonesAtom,
  chordRootAtom,
  chordFretSpreadAtom,
  hideNonChordNotesAtom,
  viewModeAtom,
  practiceLensAtom,
  colorNotesAtom,
  hiddenNotesAtom,
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
    useAtomValue(shapeDataAtom);
  const autoCenterTarget = useAtomValue(autoCenterTargetAtom);
  const recenterKey = useAtomValue(recenterKeyAtom);
  
  const chordTones = useAtomValue(activeChordTonesAtom);
  const chordRoot = useAtomValue(chordRootAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const hideNonChordNotes = useAtomValue(hideNonChordNotesAtom);
  const viewMode = useAtomValue(viewModeAtom);
  const practiceLens = useAtomValue(practiceLensAtom);
  const colorNotes = useAtomValue(colorNotesAtom);
  const hiddenNotes = useAtomValue(hiddenNotesAtom);

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
    viewMode,
    practiceLens,
    colorNotes,
    hiddenNotes,
  };
}
