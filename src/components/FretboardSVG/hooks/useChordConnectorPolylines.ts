import { useMemo } from "react";
import type { NoteData } from "./useNoteData";
import { offsetOpenPolylinePath } from "../utils/pathGeometry";
import { type CagedShape } from "@fretflow/core";
import {
  type ConnectorYBounds,
  resolveConnectorRadiusPx,
  applyConnectorRadiusFloor,
  CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
} from "../utils/connectorRadius";

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
 * v2.0: every voicing renders with paletteIndex = 0 → --chord-connector-color-1.
 * The v1 inversion-by-bass-note palette assignment (INVERSION_SLOTS +
 * inversionPaletteIndex + bassIntervalSemitones) was retired along with the
 * drop2 / triad voicing modes.
 */
const V2_PALETTE_INDEX = 0;

interface ChordConnectorVertex {
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
  /**
   * Solid center line through the voicing notes in string order — the ribbon
   * connector's spine, drawn under the note markers.
   */
  spinePath: string;
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
  /** Close-voicing fallback flag — marks a close-voicing substitute (rendered at full ribbon strength, same as full voicings). */
  isFallback?: boolean;
}

interface NormalizedChordConnectorVertex {
  stringIndex: number;
  fretIndex: number;
}

interface PendingChordConnectorVoicing {
  canonicalKey: string;
  voicingKey: string;
  noteCoords: NormalizedChordConnectorVertex[];
  sourceCombo: NoteData[];
  paletteIndex: number;
  offsetPx: number;
  shape?: CagedShape;
  isFallback?: boolean;
}

interface ExplicitChordConnectorVoicing {
  voicingKey: string;
  shape?: CagedShape;
  isFallback?: boolean;
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
const MAX_FRET_SPAN = 5;

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
 * Two-color palette: voicings whose envelopes overlap alternate between
 * default radius (0) and one step larger (3 px). Clusters of 3+ overlapping
 * voicings wrap with modulo — the third+ voicing reuses an offset already
 * taken by a neighbor, producing a visible collision. This is an explicit
 * UX trade-off: full-chord templates rarely produce ≥3-way overlaps, and
 * when they do (e.g. degraded shapes in high frets), the accepted minor
 * collision reads as more elegant than a 5-tier ladder of growing radii.
 */
const OFFSET_BUCKET = [0, 3] as const;

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
 * Assign radius offsets using a discrete vertex-share conflict graph.
 *
 * Two voicings conflict iff they share at least one `(stringIndex, fretIndex)`
 * coordinate — both polylines pass through that exact dot, so their stroke
 * bubbles overlap there regardless of render scale. This is screen-resolution
 * independent and needs no calibration constants.
 *
 * After building the graph, a deterministic greedy color pass (sorted by
 * `canonicalKey`) assigns each voicing the smallest `OFFSET_BUCKET` value
 * not already taken by any neighbor. Clusters of 3+ overlapping voicings
 * exhaust the 2-color bucket — the third+ voicing wraps modulo and shares
 * an offset with a neighbor (documented UX trade-off in `OFFSET_BUCKET`).
 */
function assignConflictOffsets(
  pendingVoicings: ReadonlyArray<{
    sourceCombo: NoteData[];
    canonicalKey: string;
    shape?: CagedShape;
  }>,
): Map<string, number> {
  const result = new Map<string, number>();
  const vertexSets = pendingVoicings.map(
    (pv) => new Set(pv.sourceCombo.map((n) => `${n.stringIndex}-${n.fretIndex}`)),
  );
  const conflicts = pendingVoicings.map(() => new Set<number>());

  for (let i = 0; i < pendingVoicings.length; i++) {
    for (let j = i + 1; j < pendingVoicings.length; j++) {
      const a = vertexSets[i]!;
      const b = vertexSets[j]!;
      let shares = false;
      // Iterate the smaller set for early termination.
      const [small, large] = a.size <= b.size ? [a, b] : [b, a];
      for (const key of small) {
        if (large.has(key)) { shares = true; break; }
      }
      if (shares) {
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

// Shared finalize step for chord-connector voicings: resolves per-voicing radii
// (with edge-safe clamps) using the `offsetPx` already assigned in the topology
// stage, then runs a post-clamp collision fix so overlapping voicings stay
// visually distinguishable when yBounds clamping collapses their radii.
function computeFinalConnectorRadii(
  pendingVoicings: ReadonlyArray<{
    rawVertices: ChordConnectorVertex[];
    sourceCombo: NoteData[];
    canonicalKey: string;
    offsetPx: number;
    shape?: CagedShape;
  }>,
  stringRowPx: number,
  lowestStringIndex: number,
  yBounds: ConnectorYBounds | undefined,
): number[] {
  const baseRadius = applyConnectorRadiusFloor(
    stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
    stringRowPx,
  );
  const radii = pendingVoicings.map((pv) => {
    return resolveConnectorRadiusPx({
      vertices: pv.rawVertices,
      preferredRadius: baseRadius + Math.max(pv.offsetPx, 0),
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

        const offI = pendingVoicings[i]!.offsetPx;
        const offJ = pendingVoicings[j]!.offsetPx;
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
 */
export function buildChordConnectorPolylines(
  noteData: NoteData[],
  chordToneNames: string[],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
  stringRowPx: number,
  yBounds?: ConnectorYBounds,
): ChordConnectorVoicing[] {
  const pending = buildPendingChordConnectorVoicings({ noteData, chordToneNames });
  return buildPixelChordConnectorVoicings({ pendingVoicings: pending, fretCenterX, stringYAt, stringRowPx, yBounds });
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
    displayName: noteName,
    displayValue: noteName,
    applyDimOpacity: false,
    applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
    isInRegion: true,
    isHidden: false,
    isTension: false,
    isGuideTone: false,
  }));
}

/**
 * Pure topology stage — discovers playable voicings and assigns conflict offsets
 * without any pixel geometry.
 *
 * For generated voicings: runs the window-scan / filtering / dedupe algorithm,
 * collects `noteCoords` (fret/string indices), then calls `assignConflictOffsets`
 * using a canonical pixel scale (TOPOLOGY_*_UNIT_PX) so the O(N²) conflict
 * graph only runs when musical data changes — not on every resize.
 *
 * For explicit voicings: builds sourceCombo, canonicalKey, voicingKey, noteCoords,
 * paletteIndex, shape, and offsetPx from the supplied voicing descriptors.
 *
 * Returns [] when chordToneNames has fewer than 2 entries, no active chord-tone
 * positions exist, or `voicingSourceActive` is true with no explicit voicings.
 */
export function buildPendingChordConnectorVoicings({
  noteData,
  chordToneNames,
  explicitVoicings,
  voicingSourceActive,
}: {
  noteData: NoteData[];
  chordToneNames: string[];
  explicitVoicings?: ExplicitChordConnectorVoicing[];
  voicingSourceActive?: boolean;
}): PendingChordConnectorVoicing[] {
  if (explicitVoicings && explicitVoicings.length > 0) {
    const pending: PendingChordConnectorVoicing[] = explicitVoicings.map((voicing) => {
      const sourceCombo = createExplicitSourceCombo(voicing.notes)
        .sort((a, b) => a.stringIndex - b.stringIndex);
      const noteCoords: NormalizedChordConnectorVertex[] = sourceCombo.map(
        ({ stringIndex, fretIndex }) => ({ stringIndex, fretIndex }),
      );
      const canonicalKey = voicing.notes
        .map((note) => `${note.stringIndex},${note.fretIndex}`)
        .sort()
        .join("|");
      return {
        canonicalKey,
        voicingKey: voicing.voicingKey,
        noteCoords,
        sourceCombo,
        paletteIndex: V2_PALETTE_INDEX,
        offsetPx: 0,
        shape: voicing.shape,
        isFallback: voicing.isFallback,
      };
    });

    const offsetMap = assignConflictOffsets(pending);
    return pending.map((pv) => ({ ...pv, offsetPx: offsetMap.get(pv.canonicalKey) ?? 0 }));
  }

  if (voicingSourceActive) return [];

  // Generated voicing path: window-scan over active chord-tone positions.

  // Collect active chord-tone positions (skip note-inactive).
  const activeTones: NoteData[] = [];
  for (const nd of noteData) {
    if (nd.noteClass === "note-inactive") continue;
    if (!CHORD_TONE_CLASSES.has(nd.noteClass)) continue;
    activeTones.push(nd);
  }

  const N = chordToneNames.length;
  if (N < 2 || activeTones.length < N) return [];

  const requiredSet = new Set(chordToneNames);

  // Determine the range of string indices present.
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

  const emitted = new Set<string>();
  const collected: Omit<PendingChordConnectorVoicing, "offsetPx">[] = [];

  // Slide an N-string window across the neck.
  for (let s = minString; s + N - 1 <= maxString; s++) {
    const windowPositions: NoteData[] = [];
    let windowFullyCovered = true;
    for (let si = s; si < s + N; si++) {
      const onString = byString.get(si);
      if (!onString || onString.length === 0) {
        windowFullyCovered = false;
        break;
      }
      for (const nd of onString) windowPositions.push(nd);
    }
    if (!windowFullyCovered) continue;

    const fretAnchors = new Set<number>();
    for (const nd of windowPositions) fretAnchors.add(nd.fretIndex);

    for (const anchor of fretAnchors) {
      const maxFretInCluster = anchor + MAX_FRET_SPAN;
      const minFretInCluster = anchor;

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

      const totalCombinations = candidatesPerString.reduce((acc, arr) => acc * arr.length, 1);
      if (totalCombinations === 0) continue;

      let bestCombo: NoteData[] | null = null;
      let bestSpan = Infinity;

      for (let combo = 0; combo < totalCombinations; combo++) {
        const picks: NoteData[] = [];
        let remainder = combo;
        for (let si = 0; si < N; si++) {
          const arr = candidatesPerString[si]!;
          const idx = remainder % arr.length;
          remainder = Math.floor(remainder / arr.length);
          picks.push(arr[idx]!);
        }

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
      if (voicingFrettedPositionCount(bestCombo) > MAX_PLAYABLE_FRET_POSITIONS) continue;

      const canonicalKey = bestCombo
        .map((p) => `${p.stringIndex},${p.fretIndex}`)
        .sort()
        .join("|");
      if (emitted.has(canonicalKey)) continue;
      emitted.add(canonicalKey);

      const noteCoords: NormalizedChordConnectorVertex[] = bestCombo.map(
        ({ stringIndex, fretIndex }) => ({ stringIndex, fretIndex }),
      );

      collected.push({
        canonicalKey,
        voicingKey: canonicalKey,
        noteCoords,
        sourceCombo: bestCombo,
        paletteIndex: V2_PALETTE_INDEX,
        shape: undefined,
      });
    }
  }

  if (collected.length === 0) return [];

  // Vertex-share conflict offsets — discrete, screen-independent.
  const offsetMap = assignConflictOffsets(collected);
  return collected.map((pv) => ({ ...pv, offsetPx: offsetMap.get(pv.canonicalKey) ?? 0 }));
}

function finalizeChordConnectorPolylines(
  pendingVoicings: Array<{
    rawVertices: ChordConnectorVertex[];
    sourceCombo: NoteData[];
    paletteIndex: number;
    canonicalKey: string;
    voicingKey: string;
    offsetPx: number;
    shape?: CagedShape;
    isFallback?: boolean;
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
    const r = radii[idx]!;
    const pathStr = offsetOpenPolylinePath(pv.rawVertices, r);
    const paths = { fill: pathStr, outline: pathStr };
    // Ribbon spine: solid center line through the voicing notes in string order.
    const spinePath = pv.rawVertices.length === 0
      ? ""
      : "M " + pv.rawVertices
          .map((v) => `${Math.round(v.x * 100) / 100} ${Math.round(v.y * 100) / 100}`)
          .join(" L ");
    return {
      paths,
      spinePath,
      vertices: pv.rawVertices,
      paletteIndex: pv.paletteIndex,
      shape: pv.shape,
      voicingKey: pv.voicingKey,
      isFallback: pv.isFallback,
    };
  });
}

/**
 * Pixel geometry stage — maps `noteCoords` to pixel vertices using the
 * supplied geometry helpers, then finalizes paths via `finalizeChordConnectorPolylines`.
 * Only re-runs when geometry helpers, stringRowPx, yBounds, or the pending
 * voicings themselves change.
 */
export function buildPixelChordConnectorVoicings({
  pendingVoicings,
  fretCenterX,
  stringYAt,
  stringRowPx,
  yBounds,
}: {
  pendingVoicings: PendingChordConnectorVoicing[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  stringRowPx: number;
  yBounds?: ConnectorYBounds;
}): ChordConnectorVoicing[] {
  if (pendingVoicings.length === 0) return [];

  const withPixelVerts = pendingVoicings.map((pv) => ({
    ...pv,
    rawVertices: pv.noteCoords.map(({ fretIndex, stringIndex }) => {
      const x = fretCenterX(fretIndex);
      const y = stringYAt(stringIndex, x);
      return { x, y };
    }),
  }));

  return finalizeChordConnectorPolylines(withPixelVerts, stringRowPx, yBounds);
}

export interface UseChordConnectorPolylinesParams {
  noteData: NoteData[];
  chordToneNames: string[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  /** Row height in pixels; used as capsule perpOffset base for collinear voicings. */
  stringRowPx: number;
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
 * React hook that memoizes `buildChordConnectorPolylines` output using two
 * independent memos:
 *
 * 1. **Topology memo** — depends on `noteData`, `chordToneNames`,
 *    `explicitVoicings`, `voicingSourceActive`. Runs the O(N²) conflict-graph
 *    assignment once per musical change and caches `PendingChordConnectorVoicing[]`.
 *
 * 2. **Pixel memo** — depends on `pendingVoicings`, `fretCenterX`, `stringYAt`,
 *    `stringRowPx`, `yBounds`. Maps normalized fret/string coords to pixel
 *    positions and emits final SVG paths. Re-runs on resize without touching
 *    the conflict graph.
 *
 * Returns `ChordConnectorVoicing[]` — one entry per distinct playable voicing.
 */
export function useChordConnectorPolylines({
  noteData,
  chordToneNames,
  fretCenterX,
  stringYAt,
  stringRowPx,
  yBounds,
  explicitVoicings,
  voicingSourceActive,
}: UseChordConnectorPolylinesParams): ChordConnectorVoicing[] {
  // Topology memo: only depends on musical data — stable across geometry changes.
  const pendingVoicings = useMemo(
    () =>
      buildPendingChordConnectorVoicings({
        noteData,
        chordToneNames,
        explicitVoicings,
        voicingSourceActive,
      }),
     
    [noteData, chordToneNames, explicitVoicings, voicingSourceActive],
  );

  // Pixel memo: only depends on geometry — runs on resize without conflict-graph cost.
  return useMemo(
    () =>
      buildPixelChordConnectorVoicings({
        pendingVoicings,
        fretCenterX,
        stringYAt,
        stringRowPx,
        yBounds,
      }),
    [pendingVoicings, fretCenterX, stringYAt, stringRowPx, yBounds],
  );
}
