/**
 * Pure selectors that pick the full-chord voicing(s) most appropriate for
 * the currently active CAGED or 3NPS position. Extracted from
 * useFretboardState so the same selection is reusable in atom land
 * (see visibleVoicingMatchesAtom in chordOverlayAtoms.ts).
 */
import type { CagedShape, Voicing, VoicingNote, ShapePolygon } from "@fretflow/core";
import type { BoxBound } from "../components/FretboardSVG/utils/semantics";

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

export interface FullChordCandidateScore {
  match: Voicing;
  outsideCount: number;
  totalOutsideDistance: number;
  maxOutsideDistance: number;
  selectedShapePriority: number;
}

export function scoreFullChordForCagedPosition(
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

export function compareFullChordCandidateScores(
  left: FullChordCandidateScore,
  right: FullChordCandidateScore,
): number {
  return left.outsideCount - right.outsideCount ||
    left.totalOutsideDistance - right.totalOutsideDistance ||
    left.maxOutsideDistance - right.maxOutsideDistance ||
    left.selectedShapePriority - right.selectedShapePriority;
}

export function getPositionKey(match: Voicing): string {
  return match.positionKeys.join("|");
}

export function selectFullChordMatchesForCagedPosition(
  matches: Voicing[],
  activePolygons: ShapePolygon[],
  selectedShapes: Set<CagedShape>,
): Voicing[] {
  const byPosition = new Map<string, Voicing>();
  for (const polygon of activePolygons) {
    if (polygon.shape !== undefined && !selectedShapes.has(polygon.shape as CagedShape)) {
      continue;
    }

    // Skip truncated shapes (off-board / clipped at nut or bridge)
    if (polygon.truncated) {
      continue;
    }

    const best = matches
      .map((match) => scoreFullChordForCagedPosition(match, polygon, selectedShapes))
      .filter((score): score is FullChordCandidateScore => score !== null)
      .sort(compareFullChordCandidateScores)[0];

    if (!best) continue;

    const { match } = best;
    const mappedMatch: Voicing = {
      ...match,
      shape: polygon.shape as CagedShape | undefined,
    };

    const positionKey = getPositionKey(mappedMatch);
    const previous = byPosition.get(positionKey);
    if (
      !previous ||
      (mappedMatch.shape !== undefined &&
        selectedShapes.has(mappedMatch.shape) &&
        !(previous.shape !== undefined && selectedShapes.has(previous.shape)))
    ) {
      byPosition.set(positionKey, mappedMatch);
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
export function scoreFullChordForThreeNpsPosition(
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

export function selectFullChordMatchesForThreeNpsPosition(
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
