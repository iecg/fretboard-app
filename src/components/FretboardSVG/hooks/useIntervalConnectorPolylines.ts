import { useMemo } from "react";
import { NOTES } from "../../../core/theory";
import { offsetOutlinePath } from "../utils/pathGeometry";
import { CHORD_CONNECTOR_BASE_RADIUS_FACTOR } from "./useChordConnectorPolylines";

/**
 * Interval connector output — one entry per interval pair.
 */
export interface IntervalConnectorPolyline {
  /**
   * Pre-computed SVG path strings for the two render layers (same path, two
   * render passes for fill + outline, mirroring chord-connector convention).
   */
  paths: { fill: string; outline: string };
  /**
   * 1-based palette index (1–8) derived from the lower-note's scale-degree
   * position. Maps to --chord-connector-color-N for per-pair color.
   */
  paletteIndex: number;
  /**
   * Stroke-width in pixels, cycled per scale-degree position so overlapping
   * borders are visually distinguishable (UAT-21).
   */
  strokeWidth: number;
  /** Stable key for React rendering. */
  key: string;
}

/** Stroke-width cycle (px) — keyed by lower-note scale-degree position mod length. */
const STROKE_CYCLE = [1.5, 2, 2.5, 3] as const;

/**
 * Compute the scale-degree position (0-based) of a note semitone within the
 * sorted scale-degrees array. Returns -1 if the note is not in the scale.
 */
function noteToScaleDegree(
  noteSemitone: number,
  scaleDegreesSorted: ReadonlyArray<number>,
): number {
  const norm = ((noteSemitone % 12) + 12) % 12;
  return scaleDegreesSorted.indexOf(norm);
}

/**
 * Build interval connector polylines for the 2-Strings interval pair feature.
 *
 * Pure function — no React dependency. Exported for direct unit testing.
 *
 * Each interval pair `{ a, b }` (both are "string-fret" coordinate strings)
 * is rendered as a capsule path matching the chord-connector visual style:
 *   - Same stroke-width via --chord-connector-outline-width
 *   - Same fill-opacity via --chord-connector-fill-opacity
 *   - Same outline-opacity via --chord-connector-outline-opacity
 *
 * Color is driven by the lower-pitched note's scale-degree position in the
 * active scale: `paletteIndex = (scaleDegree % 8) + 1` (1-based, 1..8).
 *
 * @param intervalPairs    Array of { a, b } string-fret coordinate pairs.
 * @param tuning           Open-string notes with octave (e.g. ["E4","B3","G3","D3","A2","E2"]).
 * @param scaleSemitones   Semitone offsets (0-11) of scale tones in NOTES order (not sorted).
 *                         Used to compute the lower note's scale-degree position.
 * @param fretCenterX      Maps fretIndex → SVG x coordinate.
 * @param stringYAt        Maps (stringIndex, x) → SVG y coordinate.
 * @param stringRowPx      Row height in pixels; scales the capsule radius.
 */
export function buildIntervalConnectorPolylines(
  intervalPairs: Array<{ a: string; b: string }>,
  tuning: string[],
  scaleSemitones: ReadonlyArray<number>,
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
  stringRowPx: number,
): IntervalConnectorPolyline[] {
  if (intervalPairs.length === 0) return [];

  // Build sorted scale-degree lookup once.
  const scaleDegreesSorted = [...scaleSemitones].sort((a, b) => a - b);

  /** Absolute semitone pitch of a note on the given open string + fret. */
  function absolutePitch(openStringNote: string, fret: number): number {
    // Parse note name and octave from e.g. "E4", "B3"
    const match = openStringNote.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return -1;
    const noteIdx = NOTES.indexOf(match[1]!);
    if (noteIdx === -1) return -1;
    const octave = parseInt(match[2]!, 10);
    return octave * 12 + noteIdx + fret;
  }

  const baseRadius = stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR;
  const results: IntervalConnectorPolyline[] = [];

  for (let i = 0; i < intervalPairs.length; i++) {
    const pair = intervalPairs[i]!;
    const partA = pair.a.split("-");
    const partB = pair.b.split("-");
    if (partA.length < 2 || partB.length < 2) continue;
    const sA = parseInt(partA[0]!, 10);
    const fA = parseInt(partA[1]!, 10);
    const sB = parseInt(partB[0]!, 10);
    const fB = parseInt(partB[1]!, 10);
    if (isNaN(sA) || isNaN(fA) || isNaN(sB) || isNaN(fB)) continue;

    const xA = fretCenterX(fA);
    const yA = stringYAt(sA, xA);
    const xB = fretCenterX(fB);
    const yB = stringYAt(sB, xB);

    // Determine which member is the lower-pitched one for palette color.
    const openA = tuning[sA];
    const openB = tuning[sB];
    let lowerNoteSemitone = 0;
    if (openA && openB) {
      const pitchA = absolutePitch(openA, fA);
      const pitchB = absolutePitch(openB, fB);
      // Lower pitch = larger string index (tuning is high-string-first)
      const lowerOpen = pitchA <= pitchB ? openA : openB;
      const lowerFret = pitchA <= pitchB ? fA : fB;
      const lowerMatch = lowerOpen.match(/^([A-G]#?)(-?\d+)$/);
      if (lowerMatch) {
        const lowerNoteIdx = NOTES.indexOf(lowerMatch[1]!);
        lowerNoteSemitone = ((lowerNoteIdx + lowerFret) % 12 + 12) % 12;
      }
    }

    const scaleDegree = noteToScaleDegree(lowerNoteSemitone, scaleDegreesSorted);
    // If note not in scale (scale degree = -1), use 0 as fallback.
    const effectiveDegree = scaleDegree >= 0 ? scaleDegree : 0;
    const paletteIndex = (effectiveDegree % 8) + 1;
    // UAT-21: vary stroke-width per scale-degree position so overlapping borders
    // are visually distinguishable when multiple interval classes share a note.
    const strokeWidth = STROKE_CYCLE[effectiveDegree % STROKE_CYCLE.length]!;

    // Build the path using offsetOutlinePath — for a 2-vertex "polyline" this
    // produces a capsule, matching the chord-connector visual style exactly.
    const vertices = [{ x: xA, y: yA }, { x: xB, y: yB }];
    const pathStr = offsetOutlinePath(vertices, baseRadius);
    const paths = { fill: pathStr, outline: pathStr };

    results.push({
      paths,
      paletteIndex,
      strokeWidth,
      key: `${pair.a}|${pair.b}`,
    });
  }

  return results;
}

export interface UseIntervalConnectorPolylinesParams {
  intervalPairs: Array<{ a: string; b: string }>;
  tuning: string[];
  /** Semitone offsets (0-11) of scale tones, in NOTES index order. */
  scaleSemitones: ReadonlyArray<number>;
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  stringRowPx: number;
}

/**
 * React hook that memoizes `buildIntervalConnectorPolylines` output.
 *
 * Returns `IntervalConnectorPolyline[]` — one entry per interval pair.
 * Each entry carries:
 * - `paths.fill` / `paths.outline` — pre-computed SVG path strings for
 *   the two render layers (capsule for 2-note pairs).
 * - `paletteIndex` — 1–8, derived from lower-note scale-degree position.
 *   Maps to --chord-connector-color-N CSS tokens for per-pair color.
 *
 * Mirrors the visual style of `useChordConnectorPolylines`:
 *   - fill-opacity: --chord-connector-fill-opacity
 *   - stroke-width: --chord-connector-outline-width
 *   - stroke-opacity: --chord-connector-outline-opacity
 */
export function useIntervalConnectorPolylines({
  intervalPairs,
  tuning,
  scaleSemitones,
  fretCenterX,
  stringYAt,
  stringRowPx,
}: UseIntervalConnectorPolylinesParams): IntervalConnectorPolyline[] {
  return useMemo(
    () =>
      buildIntervalConnectorPolylines(
        intervalPairs,
        tuning,
        scaleSemitones,
        fretCenterX,
        stringYAt,
        stringRowPx,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intervalPairs, tuning, scaleSemitones, stringRowPx],
  );
}
