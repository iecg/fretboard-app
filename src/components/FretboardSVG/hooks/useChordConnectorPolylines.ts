import { useMemo } from "react";

export interface ChordConnectorVertex {
  x: number;
  y: number;
}

/**
 * Maximum fret distance between consecutive positions before we break the
 * polyline into a separate segment. A span > 5 frets indicates two unrelated
 * voicing regions; connecting them with one line would cross the entire neck.
 */
export const MAX_FRET_SPAN = 5;

interface ConnectorPosition {
  stringIndex: number;
  fretIndex: number;
}

interface TaggedVertex {
  x: number;
  y: number;
  fretIndex: number;
}

/**
 * Pure function — no React dependency required. Exported for direct unit testing.
 *
 * Scans `fretboardLayout` for cells whose note name is in `chordTones`,
 * sorts the matching positions by (stringIndex asc, fretIndex asc), maps each
 * to an SVG vertex via the provided geometry helpers, then splits the sorted
 * sequence into polyline segments wherever consecutive fret indices are more
 * than MAX_FRET_SPAN apart.
 *
 * Returns an array of polylines; each polyline is an array of {x, y} vertices.
 * Returns [] when `chordTones` is empty or fewer than 2 matching positions are found.
 */
export function buildChordConnectorPolylines(
  chordTones: string[],
  fretboardLayout: string[][],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
  startFret: number,
  endFret: number,
): ChordConnectorVertex[][] {
  if (chordTones.length === 0) return [];

  const chordToneSet = new Set(chordTones);

  // Step 1: Collect all (stringIndex, fretIndex) positions that contain a chord tone.
  const positions: ConnectorPosition[] = [];
  for (let si = 0; si < fretboardLayout.length; si++) {
    const stringRow = fretboardLayout[si];
    if (!stringRow) continue;
    for (let fi = startFret; fi < Math.min(endFret, stringRow.length); fi++) {
      const noteName = stringRow[fi];
      if (noteName && chordToneSet.has(noteName)) {
        positions.push({ stringIndex: si, fretIndex: fi });
      }
    }
  }

  if (positions.length < 2) return [];

  // Step 2: Sort by (stringIndex asc, fretIndex asc).
  positions.sort((a, b) => {
    if (a.stringIndex !== b.stringIndex) return a.stringIndex - b.stringIndex;
    return a.fretIndex - b.fretIndex;
  });

  // Step 3: Map each position to SVG vertex coordinates, keeping fretIndex for step 4.
  const taggedVertices: TaggedVertex[] = positions.map((pos) => {
    const x = fretCenterX(pos.fretIndex);
    const y = stringYAt(pos.stringIndex, x);
    return { x, y, fretIndex: pos.fretIndex };
  });

  // Step 4: Split into polylines at gaps > MAX_FRET_SPAN between consecutive frets.
  const polylines: ChordConnectorVertex[][] = [];
  let current: TaggedVertex[] = [];

  for (const v of taggedVertices) {
    if (current.length === 0) {
      current.push(v);
    } else {
      const prev = current[current.length - 1];
      const fretDistance = Math.abs(v.fretIndex - prev.fretIndex);
      if (fretDistance <= MAX_FRET_SPAN) {
        current.push(v);
      } else {
        polylines.push(current.map(({ x, y }) => ({ x, y })));
        current = [v];
      }
    }
  }
  if (current.length > 0) {
    polylines.push(current.map(({ x, y }) => ({ x, y })));
  }

  // Filter out single-vertex polylines — a lone point is harmless but produces
  // no visible line, so we omit it to keep the output clean.
  return polylines.filter((pl) => pl.length >= 2);
}

export interface UseChordConnectorPolylinesParams {
  chordTones: string[];
  fretboardLayout: string[][];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  startFret: number;
  endFret: number;
}

/**
 * React hook that memoizes `buildChordConnectorPolylines` output.
 * Re-runs only when chord tones, layout, or fret range changes.
 */
export function useChordConnectorPolylines({
  chordTones,
  fretboardLayout,
  fretCenterX,
  stringYAt,
  startFret,
  endFret,
}: UseChordConnectorPolylinesParams): ChordConnectorVertex[][] {
  return useMemo(
    () =>
      buildChordConnectorPolylines(
        chordTones,
        fretboardLayout,
        fretCenterX,
        stringYAt,
        startFret,
        endFret,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chordTones, fretboardLayout, startFret, endFret],
  );
}
