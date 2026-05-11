import { useMemo } from "react";
import { NOTES } from "@fretflow/core";
import { offsetOutlinePath } from "../utils/pathGeometry";
import {
  applyConnectorRadiusFloor,
  CHORD_CONNECTOR_RADIUS_FACTORS,
  clampConnectorRadiusToYBounds,
  type ConnectorYBounds,
} from "./useChordConnectorPolylines";

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
  /** Stable key for React rendering. */
  key: string;
}

interface ParsedIntervalPair {
  inputIndex: number;
  pair: { a: string; b: string };
  sA: number;
  fA: number;
  sB: number;
  fB: number;
}

const SAME_STRING_LANE_OFFSETS_PX = [0, 3, 6, 3] as const;

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

function parseIntervalPair(
  pair: { a: string; b: string },
  inputIndex: number,
): ParsedIntervalPair | null {
  const partA = pair.a.split("-");
  const partB = pair.b.split("-");
  if (partA.length < 2 || partB.length < 2) return null;

  const sA = parseInt(partA[0]!, 10);
  const fA = parseInt(partA[1]!, 10);
  const sB = parseInt(partB[0]!, 10);
  const fB = parseInt(partB[1]!, 10);
  if (isNaN(sA) || isNaN(fA) || isNaN(sB) || isNaN(fB)) return null;

  return { inputIndex, pair, sA, fA, sB, fB };
}

function assignSameStringLaneOffsets(
  parsedPairs: ParsedIntervalPair[],
): Map<number, number> {
  const byString = new Map<number, Array<{
    inputIndex: number;
    lowerFret: number;
    upperFret: number;
  }>>();

  for (const parsed of parsedPairs) {
    if (parsed.sA !== parsed.sB) continue;
    const entries = byString.get(parsed.sA) ?? [];
    entries.push({
      inputIndex: parsed.inputIndex,
      lowerFret: Math.min(parsed.fA, parsed.fB),
      upperFret: Math.max(parsed.fA, parsed.fB),
    });
    byString.set(parsed.sA, entries);
  }

  const result = new Map<number, number>();
  for (const entries of byString.values()) {
    entries
      .sort((a, b) =>
        a.lowerFret - b.lowerFret ||
        a.upperFret - b.upperFret ||
        a.inputIndex - b.inputIndex,
      )
      .forEach((entry, laneIndex) => {
        result.set(
          entry.inputIndex,
          SAME_STRING_LANE_OFFSETS_PX[laneIndex % SAME_STRING_LANE_OFFSETS_PX.length]!,
        );
      });
  }
  return result;
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
  yBounds?: ConnectorYBounds,
): IntervalConnectorPolyline[] {
  if (intervalPairs.length === 0) return [];

  // Build sorted scale-degree lookup once.
  const scaleDegreesSorted = [...scaleSemitones].sort((a, b) => a - b);
  const parsedPairs: ParsedIntervalPair[] = [];
  for (let i = 0; i < intervalPairs.length; i++) {
    const parsed = parseIntervalPair(intervalPairs[i]!, i);
    if (parsed) parsedPairs.push(parsed);
  }
  if (parsedPairs.length === 0) return [];
  const sameStringLaneOffsetByIndex = assignSameStringLaneOffsets(parsedPairs);

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

  // Apply the same chord-root squircle floor used by chord connectors so the
  // interval capsule sits visibly outside the note bubbles. The compact
  // factor alone (0.34 × stringRowPx) lands roughly at the chord-root
  // squircle radius and would tuck the contour inside the bubble.
  const baseRadius = applyConnectorRadiusFloor(
    stringRowPx * CHORD_CONNECTOR_RADIUS_FACTORS.compact,
    stringRowPx,
  );
  const results: IntervalConnectorPolyline[] = [];

  for (const parsed of parsedPairs) {
    const { pair, sA, fA, sB, fB } = parsed;
    const xA = fretCenterX(fA);
    const xB = fretCenterX(fB);
    const yA = stringYAt(sA, xA);
    const yB = stringYAt(sB, xB);

    const laneOffset =
      sA === sB ? (sameStringLaneOffsetByIndex.get(parsed.inputIndex) ?? 0) : 0;

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

    // Build the path using offsetOutlinePath — for a 2-vertex input this
    // produces a capsule, matching the chord-connector visual style exactly.
    const vertices = [{ x: xA, y: yA }, { x: xB, y: yB }];
    const preferredRadius = baseRadius + laneOffset;
    const radius = clampConnectorRadiusToYBounds(vertices, preferredRadius, yBounds);
    const pathStr = offsetOutlinePath(vertices, radius);
    const paths = { fill: pathStr, outline: pathStr };

    results.push({
      paths,
      paletteIndex,
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
  yBounds?: ConnectorYBounds;
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
  yBounds,
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
        yBounds,
      ),
    [intervalPairs, tuning, scaleSemitones, fretCenterX, stringYAt, stringRowPx, yBounds],
  );
}
