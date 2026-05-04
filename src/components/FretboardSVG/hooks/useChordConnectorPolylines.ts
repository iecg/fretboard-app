import { useMemo } from "react";
import type { NoteData } from "./useNoteData";
import { polarSort, offsetOutlinePath } from "../utils/pathGeometry";
import { NOTE_BUBBLE_RATIO, HALO_RATIO } from "../../../core/constants";

export interface ChordConnectorVertex {
  x: number;
  y: number;
}

/**
 * Maximum fret span (inclusive) for a single playable voicing.
 * Any voicing whose max-fret minus min-fret exceeds this is dropped as
 * unplayable — the hand cannot comfortably stretch that far.
 */
export const MAX_FRET_SPAN = 5;

/**
 * Note classes treated as chord-tone roles for the connector layer.
 * Mirrors the role set in useNoteData.ts (applyDimOpacity guard) so that
 * connector membership matches what the user sees on the fretboard.
 */
export const CHORD_TONE_CLASSES = new Set([
  "note-blue",
  "chord-tone-outside-scale",
  "chord-tone-in-scale",
  "note-diatonic-chord",
  "chord-root",
  "key-tonic",
]);

/**
 * Pure function — no React dependency required. Exported for direct unit testing.
 *
 * Implements **voicing-aware shape detection** instead of an MST over pixel
 * distance. A guitar chord is played by fretting AT MOST ONE note per string at
 * a time, so a valid voicing occupies exactly N consecutive strings where N is
 * the number of distinct chord tones (e.g. 3 for a triad, 4 for a 7th chord).
 *
 * **Return shape (per voicing):**
 * ```typescript
 * { d: string; vertices: ChordConnectorVertex[] }
 * ```
 * - `d` — pre-computed SVG path `d` attribute string for the closed contour.
 *   Built via offset-outline geometry (Minkowski sum with a disk of radius
 *   `r = stringRowPx * (NOTE_BUBBLE_RATIO/2 + HALO_RATIO)`):
 *   1. Sort the raw voicing vertices by polar angle (polarSort) so the polygon
 *      visits every vertex without self-intersection.
 *   2. Dispatch on vertex count: 1 → circle, 2 → capsule, 3+ → rounded polygon.
 *   The offset ensures the contour visibly envelopes every note bubble.
 *   Near-collinear voicings (e.g. a diagonal triad) visit all vertices because
 *   polarSort retains interior/collinear points that convexHull would drop.
 * - `vertices` — original (unmodified) chord-tone pixel positions, retained for
 *   unit tests and future per-voicing color keying.
 *
 * Algorithm:
 *   1. Collect all active chord-tone positions (note-inactive excluded).
 *   2. Determine N = chordToneNames.length. If N < 2, return [].
 *   3. For each window of N consecutive strings [s, s+N-1]:
 *        a. For each unique anchor fret (every fret that appears on any string
 *           in this window), define a candidate cluster as all positions on any
 *           string in the window whose fretIndex is within MAX_FRET_SPAN of the
 *           anchor.
 *        b. Gather candidates per string: for each string in the window, the
 *           subset of positions whose fretIndex falls in the cluster fret range.
 *        c. If any string in the window has zero candidates, skip this cluster
 *           (cannot form a complete voicing).
 *        d. Generate all combinations — one position per string. Keep only
 *           combinations where the union of distinct noteNames equals the full
 *           chordToneNames set (every chord tone represented at least once,
 *           no chord tone missing).
 *        e. Among valid combinations, prefer the one with the smallest fret span
 *           (tightest grip). Emit it as an N-vertex polyline ordered by string
 *           index (highest string first).
 *   4. Deduplicate emitted voicings by their canonical "(stringIndex,fretIndex)"
 *      tuple set so that overlapping cluster anchors don't re-emit the same shape.
 *   5. For each voicing vertex list: polar-sort the vertices, then produce offset
 *      outline path via `offsetOutlinePath`.
 *
 * Returns an array of `{ d, vertices }` objects, one per distinct playable voicing.
 * Returns [] when N < 2 or no valid voicing can be assembled.
 *
 * @param noteData        Shape-aware note data from useNoteData (note-inactive already
 *                        marks positions outside the active CAGED/3NPS shape).
 * @param chordToneNames  The N distinct chord-tone note names expected in each voicing
 *                        (e.g. ["C","E","G"] for C major). Order does not matter.
 * @param fretCenterX     Maps fretIndex → SVG x coordinate.
 * @param stringYAt       Maps (stringIndex, x) → SVG y coordinate.
 * @param stringRowPx     Row height in pixels; used to scale the offset radius
 *                        (`stringRowPx * (NOTE_BUBBLE_RATIO/2 + HALO_RATIO)`).
 */
export function buildChordConnectorPolylines(
  noteData: NoteData[],
  chordToneNames: string[],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
  stringRowPx: number,
): { d: string; vertices: ChordConnectorVertex[] }[] {
  // Step 1: collect active chord-tone positions (skip note-inactive).
  const activeTones: NoteData[] = [];
  for (const nd of noteData) {
    if (nd.noteClass === "note-inactive") continue;
    if (!CHORD_TONE_CLASSES.has(nd.noteClass)) continue;
    activeTones.push(nd);
  }

  const N = chordToneNames.length;
  if (N < 2 || activeTones.length < N) return [];

  const requiredSet = new Set(chordToneNames);

  // Step 2: determine the range of string indices present.
  let minString = Infinity;
  let maxString = -Infinity;
  for (const nd of activeTones) {
    if (nd.stringIndex < minString) minString = nd.stringIndex;
    if (nd.stringIndex > maxString) maxString = nd.stringIndex;
  }

  // Build a lookup: stringIndex → positions on that string.
  const byString = new Map<number, NoteData[]>();
  for (const nd of activeTones) {
    let arr = byString.get(nd.stringIndex);
    if (!arr) {
      arr = [];
      byString.set(nd.stringIndex, arr);
    }
    arr.push(nd);
  }

  // Track emitted voicings by canonical key to deduplicate.
  const emitted = new Set<string>();
  const results: { d: string; vertices: ChordConnectorVertex[] }[] = [];

  // Step 3: slide an N-string window across the neck.
  for (let s = minString; s + N - 1 <= maxString; s++) {
    // Collect all positions across the N strings in this window.
    const windowPositions: NoteData[] = [];
    let windowFullyCovered = true;
    for (let si = s; si < s + N; si++) {
      const onString = byString.get(si);
      if (!onString || onString.length === 0) {
        windowFullyCovered = false;
        break;
      }
      for (const nd of onString) {
        windowPositions.push(nd);
      }
    }
    if (!windowFullyCovered) continue;

    // Collect all unique fret anchors present in this window.
    const fretAnchors = new Set<number>();
    for (const nd of windowPositions) {
      fretAnchors.add(nd.fretIndex);
    }

    for (const anchor of fretAnchors) {
      const maxFretInCluster = anchor + MAX_FRET_SPAN;
      const minFretInCluster = anchor;

      // For each string in the window, collect candidates in [anchor, anchor+MAX_FRET_SPAN].
      const candidatesPerString: NoteData[][] = [];
      let clusterFullyCovered = true;
      for (let si = s; si < s + N; si++) {
        const onString = byString.get(si) ?? [];
        const candidates = onString.filter(
          (nd) => nd.fretIndex >= minFretInCluster && nd.fretIndex <= maxFretInCluster,
        );
        if (candidates.length === 0) {
          clusterFullyCovered = false;
          break;
        }
        candidatesPerString.push(candidates);
      }
      if (!clusterFullyCovered) continue;

      // Generate all combinations (one per string) via iterative cartesian product.
      // We stop early if we've already found a valid voicing for this cluster.
      // For performance, limit explosion: if total combinations > 256, still proceed
      // but we'll just emit the best-span one.
      const totalCombinations = candidatesPerString.reduce((acc, arr) => acc * arr.length, 1);
      if (totalCombinations === 0) continue;

      // Enumerate combinations using index arithmetic.
      let bestCombo: NoteData[] | null = null;
      let bestSpan = Infinity;

      for (let combo = 0; combo < totalCombinations; combo++) {
        // Decode combination index to one pick per string.
        const picks: NoteData[] = [];
        let remainder = combo;
        for (let si = 0; si < N; si++) {
          const arr = candidatesPerString[si]!;
          const idx = remainder % arr.length;
          remainder = Math.floor(remainder / arr.length);
          picks.push(arr[idx]!);
        }

        // Check: union of distinct noteNames must equal the full chord-tone set.
        const coveredNotes = new Set(picks.map((p) => p.noteName));
        if (coveredNotes.size !== requiredSet.size) continue;
        let allCovered = true;
        for (const tone of requiredSet) {
          if (!coveredNotes.has(tone)) {
            allCovered = false;
            break;
          }
        }
        if (!allCovered) continue;

        // Compute fret span for this combo.
        let minF = Infinity;
        let maxF = -Infinity;
        for (const p of picks) {
          if (p.fretIndex < minF) minF = p.fretIndex;
          if (p.fretIndex > maxF) maxF = p.fretIndex;
        }
        const span = maxF - minF;
        if (span < bestSpan) {
          bestSpan = span;
          bestCombo = picks;
        }
      }

      if (!bestCombo) continue;

      // Canonical key: sorted "(stringIndex,fretIndex)" pairs.
      const canonicalKey = bestCombo
        .map((p) => `${p.stringIndex},${p.fretIndex}`)
        .sort()
        .join("|");
      if (emitted.has(canonicalKey)) continue;
      emitted.add(canonicalKey);

      // Build raw vertices ordered by string index (window order s → s+N-1).
      const rawVertices: ChordConnectorVertex[] = bestCombo.map((p) => {
        const x = fretCenterX(p.fretIndex);
        const y = stringYAt(p.stringIndex, x);
        return { x, y };
      });

      // Step 5: polar-sort the raw vertices and produce the offset outline.
      // polarSort visits every vertex (retaining near-collinear interior notes),
      // unlike convexHull which drops them. The winding-agnostic offsetOutlinePath
      // handles both CW and CCW output from polarSort correctly.
      // r = noteRadius + haloPx = stringRowPx * (NOTE_BUBBLE_RATIO/2 + HALO_RATIO)
      const polygon = polarSort(rawVertices);
      const r = stringRowPx * (NOTE_BUBBLE_RATIO / 2 + HALO_RATIO);
      const d = offsetOutlinePath(polygon, r);

      // Keep original (unmodified) vertex positions in the result for debugging
      // and future per-voicing color keying.
      results.push({ d, vertices: rawVertices });
    }
  }

  return results;
}

export interface UseChordConnectorPolylinesParams {
  noteData: NoteData[];
  chordToneNames: string[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  /** Row height in pixels; used to derive the offset radius for the contour. */
  stringRowPx: number;
}

/**
 * React hook that memoizes `buildChordConnectorPolylines` output.
 *
 * Returns `{ d: string; vertices: ChordConnectorVertex[] }[]` — one entry per
 * distinct playable voicing. Each entry carries:
 * - `d` — the SVG path `d` attribute for the closed offset-outline contour
 *   (circle, capsule, or rounded polygon that visibly envelopes all chord-tone
 *   bubbles in the voicing).
 * - `vertices` — the original chord-tone pixel positions for debugging and
 *   future per-voicing color keying.
 *
 * Re-runs only when noteData, chordToneNames, or geometry helpers change.
 */
export function useChordConnectorPolylines({
  noteData,
  chordToneNames,
  fretCenterX,
  stringYAt,
  stringRowPx,
}: UseChordConnectorPolylinesParams): { d: string; vertices: ChordConnectorVertex[] }[] {
  return useMemo(
    () =>
      buildChordConnectorPolylines(
        noteData,
        chordToneNames,
        fretCenterX,
        stringYAt,
        stringRowPx,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteData, chordToneNames, stringRowPx],
  );
}
