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

    // Map note names to array indices for fast lookup
    const upperNotes = new Map<string, number[]>();
    for (let i = 0; i < upper.length; i++) {
      const name = layout[s][upper[i]];
      if (!upperNotes.has(name)) upperNotes.set(name, []);
      upperNotes.get(name)!.push(i);
    }

    const toRemoveUpper = new Set<number>();
    const toRemoveLower = new Set<number>();

    for (let j = 0; j < lower.length; j++) {
      const name = layout[s + 1][lower[j]];
      if (name === blueNoteName) continue;
      const upperIndices = upperNotes.get(name);
      if (!upperIndices) continue;

      for (const i of upperIndices) {
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

    // Remove marked indices
    if (toRemoveUpper.size > 0) {
      const filtered = upper.filter((_, i) => !toRemoveUpper.has(i));
      perStringNotes[s] = filtered;
    }
    if (toRemoveLower.size > 0) {
      const filtered = lower.filter((_, i) => !toRemoveLower.has(i));
      perStringNotes[s + 1] = filtered;
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
      for (let f = frets + 1; f <= intendedMax; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        if (target < 0) continue;
        let bestFret = -1;
        let bestDist = Infinity;
        for (let tf = wrapSearchMin; tf <= wrapSearchMax; tf++) {
          if (layout[target][tf] === noteName) {
            const dist = Math.abs(tf - shapeCenter);
            if (dist < bestDist) {
              bestDist = dist;
              bestFret = tf;
            }
          }
        }
        if (bestFret >= 0) {
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
      for (let f = intendedMin; f < 0; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        if (target >= numStrings) continue;
        let bestFret = -1;
        let bestDist = Infinity;
        for (let tf = wrapSearchMin; tf <= wrapSearchMax; tf++) {
          if (layout[target][tf] === noteName) {
            const dist = Math.abs(tf - shapeCenter);
            if (dist < bestDist) {
              bestDist = dist;
              bestFret = tf;
            }
          }
        }
        if (bestFret >= 0) {
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
  const leftEdge: ShapeVertex[] = [];
  const rightEdge: ShapeVertex[] = [];

  for (let s = 0; s < numStrings; s++) {
    const notes = perStringNotes[s];
    if (notes.length === 0) continue;
    const nonWrapped = notes.filter(f => !wrappedNotes.has(`${s}-${f}`));
    if (nonWrapped.length === 0) continue;
    leftEdge.push({ fret: nonWrapped[0], string: s });
    rightEdge.push({ fret: nonWrapped[nonWrapped.length - 1], string: s });
  }

  return [...leftEdge, ...rightEdge.reverse()];
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
