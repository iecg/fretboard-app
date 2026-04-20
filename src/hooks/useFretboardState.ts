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
  practiceLensAtom,
  effectiveColorNotesAtom,
  effectiveHiddenNotesAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
} from "../store/atoms";
import type { CagedShape } from "../shapes";

type ActivePatternType = "caged" | "3nps" | "all";
export type ActiveShapeType = CagedShape | number | CagedShape[] | undefined;

export type ShapeScope = "single" | "multi" | "global";

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
  const practiceLens = useAtomValue(practiceLensAtom);
  const colorNotes = useAtomValue(effectiveColorNotesAtom);
  const hiddenNotes = useAtomValue(effectiveHiddenNotesAtom);

  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const cagedShapes = useAtomValue(cagedShapesAtom);
  const npsPosition = useAtomValue(npsPositionAtom);

  let activePattern: ActivePatternType | undefined;
  let activeShape: ActiveShapeType;
  let shapeScope: ShapeScope = "global";

  if (fingeringPattern === "all") {
    activePattern = "all";
    activeShape = undefined;
    shapeScope = "global";
  } else if (fingeringPattern === "caged") {
    if (cagedShapes.size === 0) {
      activePattern = "all";
      activeShape = undefined;
      shapeScope = "global";
    } else if (cagedShapes.size === 1) {
      activePattern = "caged";
      activeShape = Array.from(cagedShapes)[0] as CagedShape;
      shapeScope = "single";
    } else {
      activePattern = "all";
      activeShape = Array.from(cagedShapes) as CagedShape[];
      shapeScope = "multi";
    }
  } else if (fingeringPattern === "3nps") {
    activePattern = "3nps";
    activeShape = npsPosition;
    shapeScope = npsPosition !== undefined && npsPosition > 0 ? "single" : "global";
  }

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
    practiceLens,
    colorNotes,
    hiddenNotes,
    activePattern,
    activeShape,
    shapeScope,
  };
}
