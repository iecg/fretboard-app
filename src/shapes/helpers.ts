/** A vertex in fret/string coordinates. */
export interface ShapeVertex {
  fret: number;
  string: number;
}

/**
 * Maximum overshoot (in frets) that wrapping will attempt to recover.
 * Shapes near the nut (fret 0) or body end (max fret) may have 1–2 notes that
 * fall just outside the fretboard boundary. Wrapping relocates those notes to
 * an adjacent string so the shape remains playable at the edge.
 * Beyond 2 frets of overshoot the relocated notes are too far from their
 * original position and the result no longer resembles the intended shape.
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

    // Build a set of note names on each string for fast lookup
    const upperNotes = new Map<string, number[]>(); // noteName -> [fret indices into upper array]
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

      // This note name exists on both strings — resolve each pair
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

    // Remove marked indices (reverse order to preserve indices)
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
 * Returns the number of notes that couldn't be wrapped (truly lost) and a Set
 * of coordinate keys ("stringIndex-fretIndex") for every note placed by wrapping.
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

  // Search margin: allow wrapped notes slightly outside the strict shape range
  const wrapSearchMin = Math.max(0, shapeMin - 2);
  const wrapSearchMax = Math.min(frets, shapeMax + 2);

  // Positive overshoot: wrap to thinner string (s-1)
  // Only check strings that have notes in the shape
  // Skip if overshoot exceeds MAX_WRAP_OVERSHOOT — large overshoots produce unrecognizable shapes
  if (intendedMax > frets && intendedMax - frets <= MAX_WRAP_OVERSHOOT) {
    for (let s = numStrings - 1; s >= 0; s--) {
      if (perStringNotes[s].length === 0) continue; // string not used in shape
      const target = s - 1;
      for (let f = frets + 1; f <= intendedMax; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        if (target < 0) continue; // topmost string — can't wrap further up
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

  // Negative overshoot: wrap to thicker string (s+1)
  // Skip if overshoot exceeds MAX_WRAP_OVERSHOOT — large overshoots produce unrecognizable shapes
  if (intendedMin < 0 && -intendedMin <= MAX_WRAP_OVERSHOOT) {
    for (let s = 0; s < numStrings; s++) {
      if (perStringNotes[s].length === 0) continue; // string not used in shape
      const target = s + 1;
      for (let f = intendedMin; f < 0; f++) {
        const proxyFret = ((f % 12) + 12) % 12;
        const noteName = layout[s][proxyFret];
        if (!validNotes.includes(noteName)) continue;
        if (target >= numStrings) continue; // bottommost string — can't wrap further down
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

  // Sort and deduplicate each string
  for (let s = 0; s < numStrings; s++) {
    perStringNotes[s] = [...new Set(perStringNotes[s])].sort((a, b) => a - b);
  }

  return { unwrapped, wrappedNotes };
}

/**
 * Build polygon vertices from per-string note boundaries.
 * Left edge top→bottom, right edge bottom→top.
 * Wrapped notes are excluded from edge vertex selection so the polygon
 * reflects the core shape position without extension at fret boundaries.
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
