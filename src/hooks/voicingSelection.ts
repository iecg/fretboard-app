/**
 * Pure selectors that pick the full-chord voicing(s) most appropriate for
 * the currently active CAGED or 3NPS position. Extracted from
 * useFretboardState so the same selection is reusable in atom land
 * (see visibleVoicingMatchesAtom in chordOverlayAtoms.ts).
 */
import type { CagedShape, Voicing, VoicingNote, ShapePolygon } from "@fretflow/core";

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
 * 3NPS analogue of `scoreFullChordForCagedPosition`. Uses `patternPositions`
 * (the set of "string-fret" keys in the active 3NPS diagonal pattern) for
 * membership testing, which is diagonal-aware by construction. Where CAGED uses
 * polygon vertices, 3NPS uses the concrete position-key membership from
 * `shapeDataAtom.highlightNotes`. `selectedShapePriority` is unused for 3NPS
 * and stays at 0.
 */
export function scoreFullChordForThreeNpsPosition(
  match: Voicing,
  patternPositions: Set<string>,
  chordFretSpread: number = 0,
): FullChordCandidateScore | null {
  if (patternPositions.size === 0) {
    return {
      match,
      outsideCount: 0,
      totalOutsideDistance: 0,
      maxOutsideDistance: 0,
      selectedShapePriority: 0,
    };
  }
  let outsideCount = 0;
  let totalOutside = 0;
  let maxOutside = 0;
  for (const note of match.notes) {
    if (patternPositions.has(`${note.stringIndex}-${note.fretIndex}`)) continue;
    // Outside the pattern — distance is fret-distance to nearest same-string pattern note.
    let nearest = Infinity;
    for (const key of patternPositions) {
      const [sStr, fStr] = key.split("-");
      if (Number(sStr) !== note.stringIndex) continue;
      const d = Math.abs(Number(fStr) - note.fretIndex);
      if (d < nearest) nearest = d;
    }
    const distance = Number.isFinite(nearest) ? nearest : chordFretSpread + 1;
    outsideCount++;
    totalOutside += distance;
    if (distance > maxOutside) maxOutside = distance;
  }
  if (outsideCount > 2) return null;
  return {
    match,
    outsideCount,
    totalOutsideDistance: totalOutside,
    maxOutsideDistance: maxOutside,
    selectedShapePriority: 0,
  };
}

export function selectFullChordMatchesForThreeNpsPosition(
  matches: Voicing[],
  patternPositions: Set<string>,
  chordFretSpread: number = 0,
): Voicing[] {
  const byPosition = new Map<string, FullChordCandidateScore>();
  for (const match of matches) {
    const score = scoreFullChordForThreeNpsPosition(match, patternPositions, chordFretSpread);
    if (score === null) continue;
    const positionKey = getPositionKey(match);
    const previous = byPosition.get(positionKey);
    if (!previous || compareFullChordCandidateScores(score, previous) < 0) {
      byPosition.set(positionKey, score);
    }
  }
  return Array.from(byPosition.values()).map((s) => s.match);
}

/**
 * 3NPS analogue of selectCloseFallbacksForCagedPosition. Requires every note
 * in the voicing to be present in the diagonal pattern's position-key set.
 * Stricter than the full picker: no tolerance for notes outside the pattern.
 */
export function selectCloseFallbacksForThreeNpsPosition(
  closeMatches: Voicing[],
  patternPositions: Set<string>,
): Voicing[] {
  if (patternPositions.size === 0) return closeMatches;
  return closeMatches.filter((match) =>
    match.notes.every((note) =>
      patternPositions.has(`${note.stringIndex}-${note.fretIndex}`),
    ),
  );
}

/**
 * Picks close voicings that fit entirely inside a CAGED polygon. Used when
 * the polygon has no full-chord template available, so a close voicing
 * stands in. Stricter than the full picker: requires `outsideCount === 0`.
 */
export function selectCloseFallbacksForCagedPosition(
  closeMatches: Voicing[],
  polygon: ShapePolygon,
): Voicing[] {
  if (polygon.truncated) return [];
  return closeMatches.filter((match) =>
    match.notes.every((note) => distanceOutsidePolygon(polygon, note) === 0),
  );
}
