import React from "react";
import { useAtomValue } from "jotai";
import {
  chordTonesAtom,
  chordRootAtom,
  voicingAtom,
  chordHighlightPositionsAtom,
  visibleVoicingMatchesAtom,
} from "../store/chordOverlayAtoms";
import { activePositionAtom } from "../store/chordScope";
import { fingeringPatternAtom, cagedShapesAtom, npsPositionAtom } from "../store/fingeringAtoms";
import { noteSemanticMapAtom } from "../store/practiceLensAtoms";
import { rootNoteAtom, scaleNameAtom, preferFlatsAtom, effectiveColorNotesAtom, effectiveHiddenNotesAtom } from "../store/scaleAtoms";
import { effectiveShapeDataAtom } from "../store/shapeAtoms";
import { displayFormatAtom } from "../store/uiAtoms";
import type { CagedShape } from "@fretflow/core";

type ActivePatternType = "caged" | "3nps" | "none";
export type ActiveShapeType = CagedShape | number | CagedShape[] | undefined;
export type ShapeScope = "single" | "multi" | "global";

export function useFretboardTopologyModel() {
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const displayFormat = useAtomValue(displayFormatAtom);
  const preferFlats = useAtomValue(preferFlatsAtom);
  const noteSemanticMap = useAtomValue(noteSemanticMapAtom);
  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } =
    useAtomValue(effectiveShapeDataAtom);

  const chordTones = useAtomValue(chordTonesAtom);
  const chordRoot = useAtomValue(chordRootAtom);
  const colorNotes = useAtomValue(effectiveColorNotesAtom);
  const hiddenNotes = useAtomValue(effectiveHiddenNotesAtom);

  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const cagedShapes = useAtomValue(cagedShapesAtom);
  const npsPosition = useAtomValue(npsPositionAtom);
  const chordHighlightPositions = useAtomValue(chordHighlightPositionsAtom);
  const showChordConnectors = useAtomValue(voicingAtom) !== "off";
  const activePosition = useAtomValue(activePositionAtom);

  // Stable key for cagedShapes to avoid useMemo recomputation on every render
  const cagedShapesKey = cagedShapes.size > 0
    ? Array.from(cagedShapes).sort().join(',')
    : '';

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
  const chordBoxBounds = activePosition ? boxBounds : null;

  return React.useMemo(() => ({
    rootNote,
    scaleName,
    displayFormat,
    preferFlats,
    noteSemanticMap,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    chordTones,
    chordRoot,
    chordFretSpread: 0,
    colorNotes,
    hiddenNotes,
    activePattern,
    activeShape,
    shapeScope,
    fullChordMatches: visibleFullChordMatches,
    fullChordPositions: chordHighlightPositions,
    showChordConnectors,
    chordBoxBounds,
  }), [
    rootNote, scaleName, displayFormat, preferFlats, noteSemanticMap,
    highlightNotes, boxBounds, shapePolygons, wrappedNotes,
    chordTones, chordRoot, colorNotes, hiddenNotes,
    activePattern, cagedShapesKey, npsPosition, fingeringPattern, shapeScope, visibleFullChordMatches,
    chordHighlightPositions, showChordConnectors, chordBoxBounds
  ]);
}
