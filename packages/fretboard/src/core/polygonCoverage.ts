import type { ShapePolygon } from "@fretflow/core";

export interface PolygonCoverage {
  coveredPositions: Set<string>;
  stringRanges: Map<number, Array<{ minFret: number; maxFret: number }>>;
}

export function buildPolygonCoverage(
  polygons: readonly ShapePolygon[],
  maxFret: number,
): PolygonCoverage {
  const coveredPositions = new Set<string>();
  const stringRanges = new Map<number, Array<{ minFret: number; maxFret: number }>>();

  for (const polygon of polygons) {
    // Truncated polygons are still drawn on the fretboard — their visible
    // portion (vertices clamped to [0, maxFret]) is real coverage. Excluding
    // them here would dim notes that sit inside a polygon the user can see.
    for (let vertexIndex = 0; vertexIndex < polygon.vertices.length / 2; vertexIndex++) {
      const leftVertex = polygon.vertices[vertexIndex];
      const rightVertex = polygon.vertices[polygon.vertices.length - 1 - vertexIndex];
      if (!leftVertex || !rightVertex || leftVertex.string !== rightVertex.string) continue;

      const stringIndex = leftVertex.string;
      const minFret = Math.max(0, Math.min(leftVertex.fret, rightVertex.fret));
      const maxCoveredFret = Math.min(maxFret, Math.max(leftVertex.fret, rightVertex.fret));
      if (minFret > maxCoveredFret) continue;

      const ranges = stringRanges.get(stringIndex) ?? [];
      ranges.push({ minFret, maxFret: maxCoveredFret });
      stringRanges.set(stringIndex, ranges);

      for (let fret = minFret; fret <= maxCoveredFret; fret++) {
        coveredPositions.add(`${stringIndex}-${fret}`);
      }
    }
  }

  return { coveredPositions, stringRanges };
}
