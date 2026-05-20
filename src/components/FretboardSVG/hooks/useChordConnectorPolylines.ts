import { useMemo } from "react";
import type { NoteData } from "./useNoteData";
import { offsetOpenPolylinePath } from "../utils/pathGeometry";
import { NOTES, type CagedShape } from "@fretflow/core";
import {
  type ConnectorYBounds,
  clampConnectorRadiusToYBounds,
  resolveConnectorRadiusPx,
  applyConnectorRadiusFloor,
  CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
  CHORD_CONNECTOR_RADIUS_FACTORS,
} from "../utils/connectorRadius";

export type { ConnectorYBounds };
export {
  clampConnectorRadiusToYBounds,
  resolveConnectorRadiusPx,
  applyConnectorRadiusFloor,
  CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
  CHORD_CONNECTOR_RADIUS_FACTORS,
};

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
 * Hand-picked palette slots per inversion count, maximising perceptual
 * distance across the 8-color canonical Okabe-Ito palette:
 *
 *   slot 0 = vermillion (red-warm)
 *   slot 3 = bluish-green
 *   slot 5 = blue
 *   slot 6 = purple
 *   slot 7 = reddish-purple
 *
 * Each row maps inversion number (0 = root, 1 = 1st inv, …) to a palette
 * slot that sits in a different perceptual colour group from its neighbours.
 */
export const INVERSION_SLOTS: Record<number, readonly number[]> = {
  2: [0, 5],
  3: [0, 3, 6],
  4: [0, 3, 5, 7],
};

/**
 * Compute the palette index for a voicing based on its inversion number
 * (which chord tone is in the bass). Ensures distinct, perceptually
 * separated colours for every inversion of any chord type.
 */
export function inversionPaletteIndex(
  bestCombo: NoteData[],
  chordRoot: string,
  chordToneNames: string[],
): number {
  const bassInterval = bassIntervalSemitones(bestCombo, chordRoot);
  const rootIdx = NOTES.indexOf(chordRoot);
  if (rootIdx < 0) return 0;

  const toneIntervals = chordToneNames
    .map((name) => {
      const idx = NOTES.indexOf(name);
      return idx < 0 ? -1 : (idx - rootIdx + 12) % 12;
    })
    .filter((i) => i >= 0);
  toneIntervals.sort((a, b) => a - b);

  const unique = [...new Set(toneIntervals)];
  const invNum = unique.indexOf(bassInterval);
  if (invNum < 0) return 0;

  const slots = INVERSION_SLOTS[unique.length];
  if (slots) return slots[invNum] ?? 0;

  const step = Math.max(1, Math.floor(8 / unique.length));
  return (invNum * step) % 8;
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
  /**
   * Pre-computed SVG path strings for the two render layers.
   * For non-collinear voicings: fill === outline (same closed polygon from polarSort).
   * For collinear voicings: both are inflatedCapsulePath strings (contain arc `A` commands).
   */
  paths: { fill: string; outline: string };
  /** Original chord-tone pixel positions in string-index order. */
  vertices: ChordConnectorVertex[];
  /**
   * 0–7, deterministic per shape identity; same fingering at any neck position
   * yields same index. Used to index into --chord-connector-color-N CSS tokens.
   */
  paletteIndex: number;
  shape?: CagedShape;
  /**
   * Stable identity key derived from the canonical sorted "(stringIndex,fretIndex)"
   * pairs joined by "|" (e.g. "0,7|1,8|2,9"). Same vertex set → same key across
   * renders.
   */
  voicingKey: string;
}

interface ExplicitChordConnectorVoicing {
  voicingKey: string;
  shape?: CagedShape;
  notes: Array<{
    stringIndex: number;
    fretIndex: number;
    noteName: string;
  }>;
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

const CONNECTOR_CONFLICT_GAP_PX = 1.5;

/**
 * Per-voicing pixel offset deltas added to the base radius.
 * Assigned by adjacency-aware cluster detection so that voicings whose
 * envelopes overlap receive distinct offsets with 3 px spacing between
 * adjacent values. Non-negative: smallest envelope equals base radius
 * (no bubble-clipping risk). Five entries cap the cluster size; clusters
 * larger than 5 wrap with modulo (documented, accepted trade-off).
 */
const OFFSET_BUCKET = [0, 3, 6, 9, 12] as const;

/**
 * Compute the effective connector contour radius for one voicing.
 *
 * All voicings share a single uniform base radius so non-overlapping
 * connectors look identical. Conflict offsets are added on top only
 * when two voicings geometrically overlap.
 */
export function computeChordConnectorRadiusPx(
  _combo: NoteData[],
  stringRowPx: number,
  offsetPx: number,
): number {
  const flooredRadius = applyConnectorRadiusFloor(
    stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
    stringRowPx,
  );
  return flooredRadius + Math.max(offsetPx, 0);
}

function touchesOuterString(combo: NoteData[], lowestStringIndex: number): boolean {
  return combo.some((note) =>
    note.stringIndex === 0 || note.stringIndex === lowestStringIndex,
  );
}

function pointToSegmentDistance(
  p: ChordConnectorVertex,
  a: ChordConnectorVertex,
  b: ChordConnectorVertex,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(p.x - x, p.y - y);
}

function segmentDistance(
  a: ChordConnectorVertex,
  b: ChordConnectorVertex,
  c: ChordConnectorVertex,
  d: ChordConnectorVertex,
): number {
  const orient = (
    p: ChordConnectorVertex,
    q: ChordConnectorVertex,
    r: ChordConnectorVertex,
  ) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (
    p: ChordConnectorVertex,
    q: ChordConnectorVertex,
    r: ChordConnectorVertex,
  ) =>
    q.x >= Math.min(p.x, r.x) - 1e-9 &&
    q.x <= Math.max(p.x, r.x) + 1e-9 &&
    q.y >= Math.min(p.y, r.y) - 1e-9 &&
    q.y <= Math.max(p.y, r.y) + 1e-9;

  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (
    (o1 * o2 < 0 && o3 * o4 < 0) ||
    (Math.abs(o1) < 1e-9 && onSegment(a, c, b)) ||
    (Math.abs(o2) < 1e-9 && onSegment(a, d, b)) ||
    (Math.abs(o3) < 1e-9 && onSegment(c, a, d)) ||
    (Math.abs(o4) < 1e-9 && onSegment(c, b, d))
  ) {
    return 0;
  }

  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  );
}

function polylineDistance(
  a: ChordConnectorVertex[],
  b: ChordConnectorVertex[],
): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  if (a.length === 1 && b.length === 1) {
    return Math.hypot(a[0]!.x - b[0]!.x, a[0]!.y - b[0]!.y);
  }

  let minDistance = Infinity;
  for (let i = 0; i < Math.max(1, a.length - 1); i++) {
    const a0 = a[i]!;
    const a1 = a[Math.min(i + 1, a.length - 1)]!;
    for (let j = 0; j < Math.max(1, b.length - 1); j++) {
      const b0 = b[j]!;
      const b1 = b[Math.min(j + 1, b.length - 1)]!;
      minDistance = Math.min(minDistance, segmentDistance(a0, a1, b0, b1));
    }
  }
  return minDistance;
}

/**
 * Assign radius offsets using a centerline conflict graph. AABB clustering was
 * too coarse in some positions and too weak in dense same-fret stacks. The
 * graph is based on actual polyline distance and base effective radii, then a
 * deterministic greedy color pass selects the smallest available radius slot.
 */
function assignConflictOffsets(
  pendingVoicings: ReadonlyArray<{
    rawVertices: ChordConnectorVertex[];
    sourceCombo: NoteData[];
    canonicalKey: string;
    shape?: CagedShape;
  }>,
  stringRowPx: number,
  yBounds: ConnectorYBounds | undefined,
  lowestStringIndex: number,
): Map<string, number> {
  const result = new Map<string, number>();
  const conflicts = pendingVoicings.map(() => new Set<number>());
  const baseRadii = pendingVoicings.map((pv) =>
    resolveConnectorRadiusPx({
      vertices: pv.rawVertices,
      preferredRadius: computeChordConnectorRadiusPx(pv.sourceCombo, stringRowPx, 0),
      yBounds,
      edgeSafe: touchesOuterString(pv.sourceCombo, lowestStringIndex),
    }),
  );

  for (let i = 0; i < pendingVoicings.length; i++) {
    for (let j = i + 1; j < pendingVoicings.length; j++) {
      const distance = polylineDistance(
        pendingVoicings[i]!.rawVertices,
        pendingVoicings[j]!.rawVertices,
      );
      if (distance <= baseRadii[i]! + baseRadii[j]! + CONNECTOR_CONFLICT_GAP_PX) {
        conflicts[i]!.add(j);
        conflicts[j]!.add(i);
      }
    }
  }

  const sortedIndices = Array.from({ length: pendingVoicings.length }, (_, i) => i)
    .sort((a, b) =>
      pendingVoicings[a]!.canonicalKey.localeCompare(
        pendingVoicings[b]!.canonicalKey,
      ),
    );

  const assignedOffsets = new Map<number, number>();
  for (const idx of sortedIndices) {
    const used = new Set<number>();
    for (const neighbor of conflicts[idx]!) {
      const assigned = assignedOffsets.get(neighbor);
      if (assigned !== undefined) used.add(assigned);
    }

    const offset = OFFSET_BUCKET.find((candidate) => !used.has(candidate)) ??
      OFFSET_BUCKET[sortedIndices.indexOf(idx) % OFFSET_BUCKET.length]!;
    assignedOffsets.set(idx, offset);
    result.set(pendingVoicings[idx]!.canonicalKey, offset);
  }

  return result;
}

// Shared finalize step for chord-connector voicings: assigns conflict offsets,
// resolves per-voicing radii (with edge-safe clamps), then runs a post-clamp
// collision fix so overlapping voicings stay visually distinguishable when
// yBounds clamping collapses their radii to the same value.
function computeFinalConnectorRadii(
  pendingVoicings: ReadonlyArray<{
    rawVertices: ChordConnectorVertex[];
    sourceCombo: NoteData[];
    canonicalKey: string;
    shape?: CagedShape;
  }>,
  stringRowPx: number,
  lowestStringIndex: number,
  yBounds: ConnectorYBounds | undefined,
): number[] {
  const clusterOffsetMap = assignConflictOffsets(
    pendingVoicings,
    stringRowPx,
    yBounds,
    lowestStringIndex,
  );
  const baseRadius = applyConnectorRadiusFloor(
    stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
    stringRowPx,
  );
  const radii = pendingVoicings.map((pv) => {
    const offsetPx = clusterOffsetMap.get(pv.canonicalKey) ?? 0;
    return resolveConnectorRadiusPx({
      vertices: pv.rawVertices,
      preferredRadius: baseRadius + Math.max(offsetPx, 0),
      yBounds,
      edgeSafe: touchesOuterString(pv.sourceCombo, lowestStringIndex),
    });
  });

  if (yBounds) {
    for (let i = 0; i < pendingVoicings.length; i++) {
      for (let j = i + 1; j < pendingVoicings.length; j++) {
        const dist = polylineDistance(
          pendingVoicings[i]!.rawVertices,
          pendingVoicings[j]!.rawVertices,
        );
        if (dist > radii[i]! + radii[j]! + CONNECTOR_CONFLICT_GAP_PX) continue;
        if (Math.abs(radii[i]! - radii[j]!) >= 1) continue;

        const offI = clusterOffsetMap.get(pendingVoicings[i]!.canonicalKey) ?? 0;
        const offJ = clusterOffsetMap.get(pendingVoicings[j]!.canonicalKey) ?? 0;
        const prefI = baseRadius + Math.max(offI, 0);
        const prefJ = baseRadius + Math.max(offJ, 0);
        const clampedI = radii[i]! < prefI - 0.5;
        const clampedJ = radii[j]! < prefJ - 0.5;

        const step = OFFSET_BUCKET[1] ?? 3;
        if (clampedI && !clampedJ) {
          radii[j] = Math.max(0, radii[i]! - step);
        } else if (clampedJ && !clampedI) {
          radii[i] = Math.max(0, radii[j]! - step);
        } else if (clampedI && clampedJ) {
          if (prefI <= prefJ) {
            radii[i] = Math.max(0, radii[i]! - step);
          } else {
            radii[j] = Math.max(0, radii[j]! - step);
          }
        }
      }
    }
  }

  return radii;
}

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
 * { paths: { fill: string; outline: string }; vertices: ChordConnectorVertex[] }
 * ```
 * - `paths.fill` / `paths.outline` — pre-computed SVG path strings for the two
 *   render layers. Both strings are byte-identical for every voicing — the
 *   path is built by `offsetOpenPolylinePath(rawVertices, r)` where
 *   `r = computeChordConnectorRadiusPx(...)`. This Minkowski-sums the OPEN
 *   polyline (vertices in string-index order) with a disk to produce a
 *   rounded tube tracing the voicing — round-arc joins on convex corners,
 *   bevels on concave corners — and falls back to a capsule for exactly
 *   collinear inputs.
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
 *   5. Two-pass path generation:
 *      a. **Collect pass** — the main loop pushes `{rawVertices, paletteIndex,
 *         canonicalKey}` to a `pendingVoicings` list (no path strings yet).
 *      b. **Cluster + assign pass** — after the loop, `detectOverlapClusters`
 *         computes adjacency-aware voicing groups via inflated-AABB union-find;
 *         `assignClusterOffsets` maps each `canonicalKey` to a distinct
 *         `offsetPx` from OFFSET_BUCKET (3 px spacing). Voicings that do not
 *         overlap any other voicing receive offset 0. Finally the pending list
 *         is iterated once more to emit final paths via
 *         `offsetOpenPolylinePath(rawVertices, computeChordConnectorRadiusPx(...))`.
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
 * @param stringRowPx     Row height in pixels; scales the base Minkowski-sum disk
 *                        radius (`computeChordConnectorRadiusPx(...)`).
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
  yBounds?: ConnectorYBounds,
): ChordConnectorVoicing[] {
  // stringRowPx drives the capsule perpOffset for collinear voicings.

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

  // Pass 1: collect raw voicings (defer path generation until offsets are known).
  const pendingVoicings: {
    rawVertices: ChordConnectorVertex[];
    sourceCombo: NoteData[];
    paletteIndex: number;
    canonicalKey: string;
  }[] = [];

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

      const paletteIndex = inversionPaletteIndex(bestCombo, chordRoot, chordToneNames);

      // Collect — path generation deferred to pass 2 after conflict assignment.
      pendingVoicings.push({ rawVertices, sourceCombo: bestCombo, paletteIndex, canonicalKey });
    }
  }

  // Pass 2: assign conflict offsets, then emit final voicings with paths.
  //
  // `assignConflictOffsets` builds a graph from centerline distances and base
  // effective radii, then greedily chooses the smallest non-conflicting
  // OFFSET_BUCKET for each voicing in canonical-key order. This keeps unrelated
  // voicings tight while separating real same-stack overlaps.
  //
  // `offsetOpenPolylinePath` Minkowski-sums the rawVertices polyline (in
  // string-index order) with a disk of radius
  // `computeChordConnectorRadiusPx(...)` and dispatches internally:
  //   - 3+ non-collinear vertices → rounded tube tracing the voicing
  //     order (avoids acute-triangle silhouettes from cross-fret triads).
  //   - 3+ collinear vertices → falls back to a capsule between the extreme
  //     vertices (matches old look).
  //   - 2 vertices → capsule.
  //   - 1 vertex → circle.
  // fill === outline (byte-identical) — renderer differentiates via fill/stroke.
  let lowestStringIndex = 0;
  for (const note of noteData) {
    if (note.stringIndex > lowestStringIndex) lowestStringIndex = note.stringIndex;
  }

  const radii = computeFinalConnectorRadii(
    pendingVoicings,
    stringRowPx,
    lowestStringIndex,
    yBounds,
  );

  return pendingVoicings.map((pv, idx) => {
    const pathStr = offsetOpenPolylinePath(pv.rawVertices, radii[idx]!);
    const paths = { fill: pathStr, outline: pathStr };
    return { paths, vertices: pv.rawVertices, paletteIndex: pv.paletteIndex, voicingKey: pv.canonicalKey };
  });
}

function createExplicitSourceCombo(
  notes: ExplicitChordConnectorVoicing["notes"],
): NoteData[] {
  return notes.map(({ stringIndex, fretIndex, noteName }) => ({
    stringIndex,
    fretIndex,
    noteName,
    octave: 4,
    noteClass: "chord-tone-in-scale",
    displayValue: noteName,
    applyDimOpacity: false,
    applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
    isHidden: false,
    isTension: false,
    isGuideTone: false,
  }));
}

function finalizeChordConnectorPolylines(
  pendingVoicings: Array<{
    rawVertices: ChordConnectorVertex[];
    sourceCombo: NoteData[];
    paletteIndex: number;
    canonicalKey: string;
    voicingKey: string;
    shape?: CagedShape;
  }>,
  stringRowPx: number,
  yBounds?: ConnectorYBounds,
): ChordConnectorVoicing[] {
  if (pendingVoicings.length === 0) return [];

  let lowestStringIndex = 0;
  for (const voicing of pendingVoicings) {
    for (const note of voicing.sourceCombo) {
      if (note.stringIndex > lowestStringIndex) lowestStringIndex = note.stringIndex;
    }
  }

  const radii = computeFinalConnectorRadii(
    pendingVoicings,
    stringRowPx,
    lowestStringIndex,
    yBounds,
  );

  return pendingVoicings.map((pv, idx) => {
    const pathStr = offsetOpenPolylinePath(pv.rawVertices, radii[idx]!);
    const paths = { fill: pathStr, outline: pathStr };
    return {
      paths,
      vertices: pv.rawVertices,
      paletteIndex: pv.paletteIndex,
      shape: pv.shape,
      voicingKey: pv.voicingKey,
    };
  });
}

function buildExplicitChordConnectorPolylines(
  explicitVoicings: ExplicitChordConnectorVoicing[],
  chordToneNames: string[],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
  stringRowPx: number,
  chordRoot: string,
  yBounds?: ConnectorYBounds,
): ChordConnectorVoicing[] {
  const pendingVoicings = explicitVoicings.map((voicing) => {
    const sourceCombo = createExplicitSourceCombo(voicing.notes)
      .sort((left, right) => left.stringIndex - right.stringIndex);
    const rawVertices = sourceCombo.map((note) => {
      const x = fretCenterX(note.fretIndex);
      const y = stringYAt(note.stringIndex, x);
      return { x, y };
    });
    const canonicalKey = voicing.notes
      .map((note) => `${note.stringIndex},${note.fretIndex}`)
      .sort()
      .join("|");

    return {
      rawVertices,
      sourceCombo,
      paletteIndex: inversionPaletteIndex(sourceCombo, chordRoot, chordToneNames),
      canonicalKey,
      shape: voicing.shape,
      voicingKey: voicing.voicingKey,
    };
  });

  return finalizeChordConnectorPolylines(pendingVoicings, stringRowPx, yBounds);
}

export interface UseChordConnectorPolylinesParams {
  noteData: NoteData[];
  chordToneNames: string[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  /** Row height in pixels; used as capsule perpOffset base for collinear voicings. */
  stringRowPx: number;
  /** Sharps-only chord-root name (e.g. "C", "F#"). Drives bass-interval-based
   *  paletteIndex assignment. Empty string = paletteIndex defaults to 0. */
  chordRoot: string;
  yBounds?: ConnectorYBounds;
  explicitVoicings?: ExplicitChordConnectorVoicing[];
  /**
   * True when the voicing engine is the active connector source. When set,
   * the hook never synthesizes connectors from loose chord tones — an empty
   * `explicitVoicings` yields `[]` (the plain chord-tone overlay), not the
   * "generated scatter" fallback.
   */
  voicingSourceActive?: boolean;
}

/**
 * React hook that memoizes `buildChordConnectorPolylines` output.
 *
 * Returns `ChordConnectorVoicing[]` — one entry per distinct playable voicing.
 * Each entry carries:
 * - `paths.fill` / `paths.outline` — pre-computed SVG path strings for the two
 *   render layers. Byte-identical for non-collinear voicings (closed polygon);
 *   both are capsule paths for collinear voicings.
 * - `vertices` — the original chord-tone pixel positions for debugging.
 * - `paletteIndex` — 0–7, deterministic per shape identity; indexes into
 *   --chord-connector-color-N CSS tokens for per-voicing color differentiation.
 *
 * Re-runs when noteData, chordToneNames, or geometry helpers change.
 * The geometry helpers are included because resize/layout shifts can change
 * fret and string coordinates without changing the musical note data.
 */
export function useChordConnectorPolylines({
  noteData,
  chordToneNames,
  fretCenterX,
  stringYAt,
  stringRowPx,
  chordRoot,
  yBounds,
  explicitVoicings,
  voicingSourceActive,
}: UseChordConnectorPolylinesParams): ChordConnectorVoicing[] {
  return useMemo(
    () => {
      if (explicitVoicings && explicitVoicings.length > 0) {
        return buildExplicitChordConnectorPolylines(
          explicitVoicings,
          chordToneNames,
          fretCenterX,
          stringYAt,
          stringRowPx,
          chordRoot,
          yBounds,
        );
      }

      // A voicing source is active but produced nothing — show no connectors
      // rather than a misleading scatter over every loose chord tone.
      if (voicingSourceActive) return [];

      return buildChordConnectorPolylines(
        noteData,
        chordToneNames,
        fretCenterX,
        stringYAt,
        stringRowPx,
        chordRoot,
        yBounds,
      );
    },
    [noteData, chordToneNames, fretCenterX, stringYAt, stringRowPx, chordRoot, yBounds, explicitVoicings, voicingSourceActive],
  );
}
