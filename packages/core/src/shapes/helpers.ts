import { NOTES } from '../theory';

/** A vertex in fret/string coordinates. */
export interface ShapeVertex {
  fret: number;
  string: number;
}

/**
 * Max overshoot for wrapping. Relocated notes must stay near original position 
 * to maintain shape identity.
 */
export const MAX_WRAP_OVERSHOOT = 2;

/**
 * Deduplicate notes across adjacent strings within a shape.
 * When the same note name appears on two adjacent strings, keep the one
 * closest to its neighbors on that string. Blue notes are exempt.
 */
export function deduplicateAdjacentStrings(
  perStringNotes: number[][],
  layout: string[][],
  blueNoteName: string | null,
) {
  for (let s = 0; s < perStringNotes.length - 1; s++) {
    const upper = perStringNotes[s];
    const lower = perStringNotes[s + 1];
    if (!upper.length || !lower.length) continue;

    const openS = NOTES.indexOf(layout[s][0]);
    const openTarget = NOTES.indexOf(layout[s + 1][0]);
    const offset = (openS - openTarget + 12) % 12;
    const blueMod = blueNoteName ? (NOTES.indexOf(blueNoteName) - openTarget + 12) % 12 : -1;

    const toRemoveUpper = new Set<number>();
    const toRemoveLower = new Set<number>();

    for (let j = 0; j < lower.length; j++) {
      if (lower[j] % 12 === blueMod) continue;

      for (let i = 0; i < upper.length; i++) {
        if ((upper[i] + offset) % 12 === lower[j] % 12) {
          if (toRemoveUpper.has(i)) continue;

          // Distance to nearest neighbor on upper string
          const upperDist = Math.min(
            i > 0 ? upper[i] - upper[i - 1] : Infinity,
            i < upper.length - 1 ? upper[i + 1] - upper[i] : Infinity,
          );
          // Distance to nearest neighbor on lower string
          const lowerDist = Math.min(
            j > 0 ? lower[j] - lower[j - 1] : Infinity,
            j < lower.length - 1 ? lower[j + 1] - lower[j] : Infinity,
          );

          if (upperDist >= lowerDist) {
            toRemoveUpper.add(i);
          } else {
            toRemoveLower.add(j);
          }
        }
      }
    }

    // Remove marked indices
    if (toRemoveUpper.size > 0) {
      perStringNotes[s] = upper.filter((_, i) => !toRemoveUpper.has(i));
    }
    if (toRemoveLower.size > 0) {
      perStringNotes[s + 1] = lower.filter((_, i) => !toRemoveLower.has(i));
    }
  }
}

/**
 * Wrap notes that overshoot fretboard edges to adjacent strings.
 * Returns unwrapped count and Set of wrapped coordinate keys.
 * Called after note collection, before deduplication.
 */
export function wrapOvershootNotes(
  perStringNotes: number[][],
  layout: string[][],
  validNotes: string[],
  intendedMin: number,
  intendedMax: number,
  shapeMin: number,
  shapeMax: number,
  frets: number,
): { unwrapped: number; wrappedNotes: Set<string> } {
  const numStrings = layout.length;
  const shapeCenter = (shapeMin + shapeMax) / 2;
  let unwrapped = 0;
  const wrappedNotes = new Set<string>();

  // Margin allows wrapped notes slightly outside strict range
  const wrapSearchMin = Math.max(0, shapeMin - 2);
  const wrapSearchMax = Math.min(frets, shapeMax + 2);

  // Wrap positive overshoot to thinner string
  if (intendedMax > frets && intendedMax - frets <= MAX_WRAP_OVERSHOOT) {
    for (let s = numStrings - 1; s >= 0; s--) {
      if (perStringNotes[s].length === 0) continue;
      const target = s - 1;
      if (target < 0) continue;
      
      const openS = NOTES.indexOf(layout[s][0]);
      const openTarget = NOTES.indexOf(layout[target][0]);
      const offset = (openS - openTarget + 12) % 12;

      for (let f = frets + 1; f <= intendedMax; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        
        const rawFret = f + offset;
        const candidates = [rawFret - 12, rawFret, rawFret + 12]
          .filter(c => c >= wrapSearchMin && c <= wrapSearchMax);
          
        if (candidates.length > 0) {
          // Find closest to shapeCenter
          const bestFret = candidates.reduce((a, b) => 
            Math.abs(b - shapeCenter) < Math.abs(a - shapeCenter) ? b : a
          );
          perStringNotes[target].push(bestFret);
          wrappedNotes.add(`${target}-${bestFret}`);
        } else {
          unwrapped++;
        }
      }
    }
  }

  // Wrap negative overshoot to thicker string
  if (intendedMin < 0 && -intendedMin <= MAX_WRAP_OVERSHOOT) {
    for (let s = 0; s < numStrings; s++) {
      if (perStringNotes[s].length === 0) continue;
      const target = s + 1;
      if (target >= numStrings) continue;

      const openS = NOTES.indexOf(layout[s][0]);
      const openTarget = NOTES.indexOf(layout[target][0]);
      const offset = (openS - openTarget + 12) % 12;

      for (let f = intendedMin; f < 0; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        
        const rawFret = f + offset;
        const candidates = [rawFret - 12, rawFret, rawFret + 12]
          .filter(c => c >= wrapSearchMin && c <= wrapSearchMax);
          
        if (candidates.length > 0) {
          const bestFret = candidates.reduce((a, b) => 
            Math.abs(b - shapeCenter) < Math.abs(a - shapeCenter) ? b : a
          );
          perStringNotes[target].push(bestFret);
          wrappedNotes.add(`${target}-${bestFret}`);
        } else {
          unwrapped++;
        }
      }
    }
  }

  // Sort and deduplicate strings
  for (let s = 0; s < numStrings; s++) {
    perStringNotes[s] = [...new Set(perStringNotes[s])].sort((a, b) => a - b);
  }

  return { unwrapped, wrappedNotes };
}

/**
 * Build vertices from string boundaries. Excludes wrapped notes to preserve 
 * core shape position. Left edge top→bottom, right edge bottom→top.
 */
export function buildPolygonFromNotes(
  perStringNotes: number[][],
  numStrings: number,
  wrappedNotes: Set<string> = new Set(),
): ShapeVertex[] {
  const vertices: ShapeVertex[] = [];
  const rightEdge: ShapeVertex[] = [];

  for (let s = 0; s < numStrings; s++) {
    const notes = perStringNotes[s];
    if (notes.length === 0) continue;
    const nonWrapped = notes.filter(f => !wrappedNotes.has(`${s}-${f}`));
    if (nonWrapped.length === 0) continue;
    vertices.push({ fret: nonWrapped[0], string: s });
    rightEdge.push({ fret: nonWrapped[nonWrapped.length - 1], string: s });
  }

  for (let i = rightEdge.length - 1; i >= 0; i--) {
    vertices.push(rightEdge[i]);
  }

  return vertices;
}

/**
 * Returns true if the fretboard boundary clips more than half the intended fret
 * span, meaning the shape is too incomplete to be useful at this position.
 */
export function isShapeTruncated(
  intendedMin: number,
  intendedMax: number,
  shapeMin: number,
  shapeMax: number,
): boolean {
  const intendedSpan = intendedMax - intendedMin;
  const visibleSpan = shapeMax - shapeMin;
  return intendedSpan > 0 && visibleSpan <= intendedSpan / 2;
}
