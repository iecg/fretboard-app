import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  chordTonesAtom,
  chordRootAtom,
  practiceLensAtom,
  voicingMatchesAtom,
  voicingAtom,
  chordHighlightPositionsAtom,
} from "../store/chordOverlayAtoms";
import { chordScopeToPositionAtom, activePositionAtom } from "../store/chordScope";
import { recenterKeyAtom, fingeringPatternAtom, cagedShapesAtom, npsPositionAtom } from "../store/fingeringAtoms";
import { currentTuningAtom, fretStartAtom, fretEndAtom } from "../store/layoutAtoms";
import { noteSemanticMapAtom } from "../store/practiceLensAtoms";
import { rootNoteAtom, scaleNameAtom, preferFlatsAtom, effectiveColorNotesAtom, effectiveHiddenNotesAtom } from "../store/scaleAtoms";
import { effectiveShapeDataAtom, autoCenterTargetAtom } from "../store/shapeAtoms";
import { displayFormatAtom } from "../store/uiAtoms";
import type { CagedShape, Voicing, VoicingNote, ShapePolygon } from "@fretflow/core";
import type { BoxBound } from "../components/FretboardSVG/utils/semantics";

type ActivePatternType = "caged" | "3nps" | "none";
export type ActiveShapeType = CagedShape | number | CagedShape[] | undefined;

export type ShapeScope = "single" | "multi" | "global";

function distanceOutsidePolygon(
  polygon: ShapePolygon,
  note: VoicingNote,
): number {
  const leftFret = polygon.vertices[note.stringIndex]?.fret;
  const rightFret = polygon.vertices[polygon.vertices.length - 1 - note.stringIndex]?.fret;
  if (leftFret === undefined || rightFret === undefined) return Number.POSITIVE_INFINITY;

  const minFret = Math.min(leftFret, rightFret);
  const maxFret = Math.max(leftFret, rightFret);
  if (note.fretIndex < minFret) return minFret - note.fretIndex;
  if (note.fretIndex > maxFret) return note.fretIndex - maxFret;
  return 0;
}

interface FullChordCandidateScore {
  match: Voicing;
  outsideCount: number;
  totalOutsideDistance: number;
  maxOutsideDistance: number;
  selectedShapePriority: number;
}

function scoreFullChordForCagedPosition(
  match: Voicing,
  polygon: ShapePolygon,
  selectedShapes: Set<CagedShape>,
): FullChordCandidateScore | null {
  const outsideDistances = match.notes.map((note) => distanceOutsidePolygon(polygon, note));
  const outsideCount = outsideDistances.filter((distance) => distance > 0).length;
  if (outsideCount > 2) return null;

  return {
    match,
    outsideCount,
    totalOutsideDistance: outsideDistances.reduce((sum, distance) => sum + distance, 0),
    maxOutsideDistance: Math.max(...outsideDistances),
    selectedShapePriority: match.shape !== undefined && selectedShapes.has(match.shape) ? 0 : 1,
  };
}

function compareFullChordCandidateScores(
  left: FullChordCandidateScore,
  right: FullChordCandidateScore,
): number {
  return left.outsideCount - right.outsideCount ||
    left.totalOutsideDistance - right.totalOutsideDistance ||
    left.maxOutsideDistance - right.maxOutsideDistance ||
    left.selectedShapePriority - right.selectedShapePriority;
}

function getPositionKey(match: Voicing): string {
  return match.positionKeys.join("|");
}

function selectFullChordMatchesForCagedPosition(
  matches: Voicing[],
  activePolygons: ShapePolygon[],
  selectedShapes: Set<CagedShape>,
): Voicing[] {
  const byPosition = new Map<string, Voicing>();
  for (const polygon of activePolygons) {
    const best = matches
      .map((match) => scoreFullChordForCagedPosition(match, polygon, selectedShapes))
      .filter((score): score is FullChordCandidateScore => score !== null)
      .sort(compareFullChordCandidateScores)[0];

    if (!best) continue;

    const { match } = best;
    const positionKey = getPositionKey(match);
    const previous = byPosition.get(positionKey);
    if (
      !previous ||
      (match.shape !== undefined &&
        selectedShapes.has(match.shape) &&
        !(previous.shape !== undefined && selectedShapes.has(previous.shape)))
    ) {
      byPosition.set(positionKey, match);
    }
  }
  return Array.from(byPosition.values());
}

/**
 * 3NPS analogue of `scoreFullChordForCagedPosition`. Where CAGED uses polygon
 * vertices to derive per-string left/right fret bounds, 3NPS exposes per-string
 * `boxBounds` directly. Same `outsideCount ≤ 2` tolerance and `chordFretSpread`
 * buffer so the existing comparator handles both. `selectedShapePriority` is
 * unused for 3NPS and stays at 0.
 */
function scoreFullChordForThreeNpsPosition(
  match: Voicing,
  boxBounds: BoxBound[],
  chordFretSpread: number,
): FullChordCandidateScore | null {
  const outsideDistances = match.notes.map((note) => {
    const b = boxBounds[note.stringIndex];
    if (!b) return Number.POSITIVE_INFINITY;
    const minFret = b.minFret - chordFretSpread;
    const maxFret = b.maxFret + chordFretSpread;
    if (note.fretIndex < minFret) return minFret - note.fretIndex;
    if (note.fretIndex > maxFret) return note.fretIndex - maxFret;
    return 0;
  });
  const outsideCount = outsideDistances.filter((d) => d > 0).length;
  if (outsideCount > 2) return null;
  return {
    match,
    outsideCount,
    totalOutsideDistance: outsideDistances.reduce((sum, d) => sum + d, 0),
    maxOutsideDistance: Math.max(...outsideDistances),
    selectedShapePriority: 0,
  };
}

function selectFullChordMatchesForThreeNpsPosition(
  matches: Voicing[],
  boxBounds: BoxBound[],
  chordFretSpread: number,
): Voicing[] {
  const byPosition = new Map<string, FullChordCandidateScore>();
  for (const match of matches) {
    const score = scoreFullChordForThreeNpsPosition(match, boxBounds, chordFretSpread);
    if (score === null) continue;
    const positionKey = getPositionKey(match);
    const previous = byPosition.get(positionKey);
    if (!previous || compareFullChordCandidateScores(score, previous) < 0) {
      byPosition.set(positionKey, score);
    }
  }
  return Array.from(byPosition.values()).map((s) => s.match);
}

export function useFretboardState() {
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
  const fullChordMatches = useAtomValue(voicingMatchesAtom);
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
      activePattern = "none";
      activeShape = Array.from(cagedShapes) as CagedShape[];
      shapeScope = "multi";
    }
  } else if (fingeringPattern === "3nps") {
    activePattern = "3nps";
    activeShape = npsPosition;
    shapeScope = npsPosition !== undefined && npsPosition > 0 ? "single" : "global";
  }

  const visibleFullChordMatches = useMemo(() => {
    if (!chordScopeToPosition || !activePosition) return fullChordMatches;
    if (fingeringPattern === "caged") {
      return selectFullChordMatchesForCagedPosition(
        fullChordMatches,
        shapePolygons,
        cagedShapes,
      );
    }
    if (fingeringPattern === "3nps") {
      return selectFullChordMatchesForThreeNpsPosition(
        fullChordMatches,
        boxBounds,
        0,
      );
    }
    return fullChordMatches;
  }, [
    chordScopeToPosition,
    activePosition,
    fingeringPattern,
    fullChordMatches,
    shapePolygons,
    cagedShapes,
    boxBounds,
  ]);
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
