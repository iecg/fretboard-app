import { useAtomValue } from "jotai";
import {
  chordTonesAtom,
  chordRootAtom,
  practiceLensAtom,
  voicingAtom,
  chordHighlightPositionsAtom,
  visibleVoicingMatchesAtom,
} from "../store/chordOverlayAtoms";
import { chordScopeToPositionAtom, activePositionAtom } from "../store/chordScope";
import { recenterKeyAtom, fingeringPatternAtom, cagedShapesAtom, npsPositionAtom } from "../store/fingeringAtoms";
import { currentTuningAtom, fretStartAtom, fretEndAtom } from "../store/layoutAtoms";
import { noteSemanticMapAtom } from "../store/practiceLensAtoms";
import { rootNoteAtom, scaleNameAtom, preferFlatsAtom, effectiveColorNotesAtom, effectiveHiddenNotesAtom } from "../store/scaleAtoms";
import { effectiveShapeDataAtom, autoCenterTargetAtom } from "../store/shapeAtoms";
import { displayFormatAtom } from "../store/uiAtoms";
import type { CagedShape } from "@fretflow/core";

type ActivePatternType = "caged" | "3nps" | "none";
export type ActiveShapeType = CagedShape | number | CagedShape[] | undefined;
export type ShapeScope = "single" | "multi" | "global";

export function useFretboardTopologyModel() {
  const currentTuning = useAtomValue(currentTuningAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);
  const displayFormat = useAtomValue(displayFormatAtom);
  const preferFlats = useAtomValue(preferFlatsAtom);
  const noteSemanticMap = useAtomValue(noteSemanticMapAtom);
  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } =
    useAtomValue(effectiveShapeDataAtom);
  const autoCenterTarget = useAtomValue(autoCenterTargetAtom);
  const recenterKey = useAtomValue(recenterKeyAtom);

  const chordTones = useAtomValue(chordTonesAtom);
  const chordRoot = useAtomValue(chordRootAtom);
  const practiceLens = useAtomValue(practiceLensAtom);
  const colorNotes = useAtomValue(effectiveColorNotesAtom);
  const hiddenNotes = useAtomValue(effectiveHiddenNotesAtom);

  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const cagedShapes = useAtomValue(cagedShapesAtom);
  const npsPosition = useAtomValue(npsPositionAtom);
  const chordHighlightPositions = useAtomValue(chordHighlightPositionsAtom);
  const showChordConnectors = useAtomValue(voicingAtom) !== "off";
  const chordScopeToPosition = useAtomValue(chordScopeToPositionAtom);
  const activePosition = useAtomValue(activePositionAtom);

  let activePattern: ActivePatternType | undefined;
  let activeShape: ActiveShapeType;
  let shapeScope: ShapeScope = "global";

  if (fingeringPattern === "none") {
    activePattern = "none";
    activeShape = undefined;
    shapeScope = "global";
  } else if (fingeringPattern === "caged") {
    if (cagedShapes.size === 0) {
      activePattern = "none";
      activeShape = undefined;
      shapeScope = "global";
    } else if (cagedShapes.size === 1) {
      activePattern = "caged";
      activeShape = Array.from(cagedShapes)[0] as CagedShape;
      shapeScope = "single";
    } else {
      activePattern = "caged";
      activeShape = Array.from(cagedShapes) as CagedShape[];
      shapeScope = "multi";
    }
  } else if (fingeringPattern === "3nps") {
    activePattern = "3nps";
    activeShape = npsPosition;
    shapeScope = npsPosition !== undefined && npsPosition > 0 ? "single" : "global";
  }

  const visibleFullChordMatches = useAtomValue(visibleVoicingMatchesAtom);
  const chordBoxBounds = chordScopeToPosition && activePosition ? boxBounds : null;

  return {
    currentTuning,
    rootNote,
    scaleName,
    startFret,
    endFret,
    displayFormat,
    preferFlats,
    noteSemanticMap,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    recenterKey,
    chordTones,
    chordRoot,
    chordFretSpread: 0,
    practiceLens,
    colorNotes,
    hiddenNotes,
    activePattern,
    activeShape,
    shapeScope,
    fullChordMatches: visibleFullChordMatches,
    /**
     * Set of "stringIndex-fretIndex" keys that should render the chord-tone
     * emphasis. Sourced from {@link chordHighlightPositionsAtom} (union of
     * every fitting candidate's positions).
     */
    fullChordPositions: chordHighlightPositions,
    showChordConnectors,
    chordBoxBounds,
  };
}
