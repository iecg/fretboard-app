import { useMemo } from "react";
import type { NoteData } from "./useNoteData";
import { openPolylinePath } from "../utils/pathGeometry";
import { NOTES } from "../../../core/theory";

/**
 * Count the number of distinct fret positions spanned by the **fretted** notes
 * in a voicing (open strings excluded), inclusive of both endpoints.
 *
 * Examples:
 *   frets [5,6,8,8] → positions {5,6,7,8} → count 4  (max-min+1 = 8-5+1)
 *   frets [4,5,5,6] → positions {4,5,6}   → count 3  (max-min+1 = 6-4+1)
 *   frets [5,5,5]   → positions {5}        → count 1  (max-min+1 = 5-5+1)
 *
 * Returns 0 when there are fewer than 2 fretted notes — a voicing
 * with 0 or 1 fretted note has no meaningful span and must not be filtered out.
 */
function voicingFrettedPositionCount(combo: NoteData[]): number {
  let minF = Infinity;
  let maxF = -Infinity;
  let frettedCount = 0;
  for (const p of combo) {
    if (p.fretIndex === 0) continue; // open string — excluded from span
    if (p.fretIndex < minF) minF = p.fretIndex;
    if (p.fretIndex > maxF) maxF = p.fretIndex;
    frettedCount++;
  }
  return frettedCount < 2 ? 0 : maxF - minF + 1;
}

/**
 * Compute the bass-note interval (in semitones, 0-11) from the chord root to
 * the lowest physical note in a voicing.
 *
 * Convention: stringIndex 0 = highest string (high E), stringIndex 5 = lowest
 * string (low E). Within a 5-fret voicing window in standard tuning, the
 * pick on the highest stringIndex is essentially always the lowest pitch.
 *
 * Returns 0 if either chordRoot or the bass-note name is not in the NOTES table
 * — defensive default keeps paletteIndex stable at 0 rather than throwing.
 */
function bassIntervalSemitones(bestCombo: NoteData[], chordRoot: string): number {
  if (bestCombo.length === 0) return 0;
  let bass = bestCombo[0]!;
  for (let i = 1; i < bestCombo.length; i++) {
    if (bestCombo[i]!.stringIndex > bass.stringIndex) bass = bestCombo[i]!;
  }
  const rootIdx = NOTES.indexOf(chordRoot);
  const bassIdx = NOTES.indexOf(bass.noteName);
  if (rootIdx < 0 || bassIdx < 0) return 0;
  return (bassIdx - rootIdx + 12) % 12;
}

export interface ChordConnectorVertex {
  x: number;
  y: number;
}

/**
 * A single playable voicing returned by the chord-connector hook.
 */
export interface ChordConnectorVoicing {
  /** Pre-computed SVG path `d` string for the open polyline through every chord-tone vertex. */
  d: string;
  /** Original chord-tone pixel positions in string-index order. */
  vertices: ChordConnectorVertex[];
  /**
   * 0–7, deterministic per shape identity; same fingering at any neck position
   * yields same index. Used to index into --chord-connector-color-N CSS tokens.
   */
  paletteIndex: number;
}

/**
 * Maximum fret span (inclusive) for the cluster candidate-gathering window.
 * Notes further than this from the cluster anchor are excluded from candidates.
 */
export const MAX_FRET_SPAN = 5;

/**
 * Maximum number of distinct fret positions (inclusive) allowed across the
 * **fretted** notes of a selected voicing. Open strings (fretIndex === 0) are
 * excluded — they are reachable from any hand position.
 *
 * "3 fret positions" means the fretted notes span at most frets N, N+1, N+2
 * (i.e., max(fretted) − min(fretted) + 1 ≤ 3, equivalently max − min ≤ 2).
 *
 * Voicings where voicingFrettedPositionCount(combo) > MAX_PLAYABLE_FRET_POSITIONS
 * are dropped as unplayable — a standard hand cannot comfortably cover more
 * than 3 adjacent fret positions.
 *
 * Examples dropped (4 positions): frets [5,6,8,8] → positions 5,6,7,8 → count 4.
 * Examples kept  (3 positions): frets [4,5,5,6] → positions 4,5,6   → count 3.
 */
export const MAX_PLAYABLE_FRET_POSITIONS = 3;

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
 * - `d` — pre-computed SVG path `d` string for an open polyline through every
 *   chord-tone vertex in string-index order (M + L commands, no Z). Rendered
 *   as a fat stroked path; the browser's stroke renderer produces rounded caps
 *   and joins so every note bubble is enveloped regardless of topology.
 * - `vertices` — original (unmodified) chord-tone pixel positions in string-index
 *   order, retained for unit tests and future per-voicing color keying.
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
 *   5. For each voicing vertex list: emit an open polyline path (`d`) in
 *      string-index order — no polar sort, no convex hull, no offset geometry.
 *      The browser's stroke renderer with rounded caps/joins handles all visual
 *      enveloping via CSS stroke-width.
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
 * @param stringRowPx     Row height in pixels; kept for API compatibility (no longer
 *                        used in geometry — CSS handles stroke-width scaling).
 * @param chordRoot       Sharps-only chord-root name (e.g. "C", "F#"). Used to
 *                        compute the bass-note interval that drives paletteIndex.
 *                        Empty string = paletteIndex defaults to 0.
 */
export function buildChordConnectorPolylines(
  noteData: NoteData[],
  chordToneNames: string[],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
  stringRowPx: number,
  chordRoot: string,
): ChordConnectorVoicing[] {
  // stringRowPx is kept in the signature for API compatibility; CSS now handles
  // stroke-width scaling via the --string-row-px custom property.
  void stringRowPx;

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
  const results: ChordConnectorVoicing[] = [];

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

      // Drop voicings whose fretted-note position count exceeds the playability
      // threshold. Open strings (fretIndex === 0) are excluded — they are
      // reachable from any hand position.
      if (voicingFrettedPositionCount(bestCombo) > MAX_PLAYABLE_FRET_POSITIONS) continue;

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

      // Step 5: single-layer fat polyline path.
      // Vertices stay in string-index order — natural musical traversal across strings.
      // CSS stroke-width + stroke-linecap/linejoin handle enveloping of every note bubble.
      const d = openPolylinePath(rawVertices);

      // Compute palette index from the bass-note interval (semitones from
      // chord root). Same inversion → same color across positions and chord
      // qualities. Root in bass = 0 → palette[0]; major 3rd in bass = 4 →
      // palette[4]; perfect 5th in bass = 7 → palette[7]; etc.
      const paletteIndex = bassIntervalSemitones(bestCombo, chordRoot) % 8;

      // Keep original (unmodified) vertex positions in the result.
      results.push({ d, vertices: rawVertices, paletteIndex });
    }
  }

  return results;
}

export interface UseChordConnectorPolylinesParams {
  noteData: NoteData[];
  chordToneNames: string[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  /** Row height in pixels; passed through for API compatibility (CSS handles scaling). */
  stringRowPx: number;
  /** Sharps-only chord-root name (e.g. "C", "F#"). Drives bass-interval-based
   *  paletteIndex assignment. Empty string = paletteIndex defaults to 0. */
  chordRoot: string;
}

/**
 * React hook that memoizes `buildChordConnectorPolylines` output.
 *
 * Returns `ChordConnectorVoicing[]` — one entry per distinct playable voicing.
 * Each entry carries:
 * - `d` — the SVG path `d` attribute for an open polyline through every chord-tone
 *   vertex in string-index order (M + L commands, no Z). Rendered as a fat stroked
 *   path; CSS stroke-width + stroke-linecap/linejoin handle enveloping.
 * - `vertices` — the original chord-tone pixel positions for debugging.
 * - `paletteIndex` — 0–7, deterministic per shape identity; indexes into
 *   --chord-connector-color-N CSS tokens for per-voicing color differentiation.
 *
 * Re-runs only when noteData, chordToneNames, or geometry helpers change.
 */
export function useChordConnectorPolylines({
  noteData,
  chordToneNames,
  fretCenterX,
  stringYAt,
  stringRowPx,
  chordRoot,
}: UseChordConnectorPolylinesParams): ChordConnectorVoicing[] {
  return useMemo(
    () =>
      buildChordConnectorPolylines(
        noteData,
        chordToneNames,
        fretCenterX,
        stringYAt,
        stringRowPx,
        chordRoot,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteData, chordToneNames, stringRowPx, chordRoot],
  );
}
