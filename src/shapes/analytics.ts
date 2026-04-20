import type { ShapePolygon } from "./polygons";

/**
 * Check if a shape has any wrapped notes.
 */
export function hasWrappedNotes(poly: ShapePolygon, wrappedNotes: Set<string>): boolean {
  for (const vert of poly.vertices) {
    if (wrappedNotes.has(`${vert.string}-${vert.fret}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Find the main CAGED shape to auto-center.
 * The main shape is the one with the lowest root fret that is "complete"
 * (no wrapped notes, not truncated, and entirely within visible fret range).
 */
export function findMainShape(
  polygons: ShapePolygon[],
  wrappedNotes: Set<string>,
  startFret: number,
  endFret: number,
): ShapePolygon | null {
  // Filter to complete shapes (no wrapped notes, not truncated, fully visible)
  const completeShapes = polygons.filter((poly) => {
    if (poly.truncated) return false;
    // Check if any vertex is a wrapped note
    for (const vert of poly.vertices) {
      if (wrappedNotes.has(`${vert.string}-${vert.fret}`)) {
        return false;
      }
    }
    // Entire shape must be within visible fret range
    if (poly.intendedMin < startFret || poly.intendedMax > endFret) {
      return false;
    }
    return true;
  });

  if (completeShapes.length === 0) return null;

  // Find the shape with the lowest intendedMin (lowest root position)
  return completeShapes.reduce((lowest, current) =>
    current.intendedMin < lowest.intendedMin ? current : lowest
  );
}

/**
 * Calculate the center fret of a shape polygon.
 */
export function getShapeCenterFret(poly: ShapePolygon): number {
  return (poly.intendedMin + poly.intendedMax) / 2;
}

/**
 * Check if any part of a shape is outside the visible fret range.
 * exported for external consumers
 */
export function isShapeOutOfView(
  poly: ShapePolygon,
  startFret: number,
  endFret: number,
): boolean {
  // Shape is out of view if any part extends beyond visible range
  const shapeMin = Math.max(0, poly.intendedMin);
  const shapeMax = poly.intendedMax;
  return shapeMin < startFret || shapeMax > endFret;
}
