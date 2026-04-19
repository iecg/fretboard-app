import { useAtomValue } from "jotai";
import {
  currentTuningAtom,
  rootNoteAtom,
  fretStartAtom,
  fretEndAtom,
  displayFormatAtom,
  useFlatsAtom,
  noteRoleMapAtom,
  shapeDataAtom,
  autoCenterTargetAtom,
  recenterKeyAtom,
} from "../store/atoms";

export function useFretboardState() {
  const currentTuning = useAtomValue(currentTuningAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);
  const displayFormat = useAtomValue(displayFormatAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const noteRoleMap = useAtomValue(noteRoleMapAtom);
  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } =
    useAtomValue(shapeDataAtom);
  const autoCenterTarget = useAtomValue(autoCenterTargetAtom);
  const recenterKey = useAtomValue(recenterKeyAtom);

  return {
    currentTuning,
    rootNote,
    startFret,
    endFret,
    displayFormat,
    useFlats,
    noteRoleMap,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    recenterKey,
  };
}
