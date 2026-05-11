import { useMemo } from "react";
import type { NoteData } from "./useNoteData";
import { convexHull, offsetOutlinePath } from "../utils/pathGeometry";
import { NOTES } from "@fretflow/core";

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
  /**
   * Stable identity key derived from the canonical sorted "(stringIndex,fretIndex)"
   * pairs joined by "|" (e.g. "0,7|1,8|2,9"). Same vertex set → same key across
   * renders.
   */
  voicingKey: string;
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
 * Minkowski-sum disk radius factor for the chord-connector outline envelope.
 * Applied as `stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR + offsetPx`.
 * Reduced from the legacy value to sit the outline closer to the note bubbles.
 */
export const CHORD_CONNECTOR_BASE_RADIUS_FACTOR = 0.47;

export interface ConnectorYBounds {
  minY: number;
  maxY: number;
}

const CONNECTOR_BOUNDARY_GUARD_PX = 1;

export function clampConnectorRadiusToYBounds(
  vertices: ChordConnectorVertex[],
  preferredRadius: number,
  yBounds?: ConnectorYBounds,
): number {
  if (!yBounds || vertices.length === 0) return preferredRadius;

  let minVertexY = Infinity;
  let maxVertexY = -Infinity;
  for (const vertex of vertices) {
    if (vertex.y < minVertexY) minVertexY = vertex.y;
    if (vertex.y > maxVertexY) maxVertexY = vertex.y;
  }

  const availableRadius = Math.min(
    minVertexY - yBounds.minY,
    yBounds.maxY - maxVertexY,
  ) - CONNECTOR_BOUNDARY_GUARD_PX;

  return Math.max(0, Math.min(preferredRadius, availableRadius));
}

/**
 * Per-voicing pixel offset deltas added to the base radius.
 * Assigned by adjacency-aware cluster detection so that voicings whose
 * envelopes overlap receive distinct offsets with 2 px spacing between
 * adjacent values. Non-negative: smallest envelope equals base radius
 * (no bubble-clipping risk). Six entries cap the cluster size; clusters
 * larger than 6 wrap with modulo (documented, accepted trade-off).
 */
const OFFSET_BUCKET = [0, 2, 4, 6, 8, 10] as const;

/**
 * Compute the axis-aligned bounding box of a set of vertices, inflated
 * outward by `inflateBy` pixels on every side. Used to approximate
 * envelope-vs-envelope overlap before full geometry is computed.
 */
function inflatedAABB(
  vertices: ChordConnectorVertex[],
  inflateBy: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  return {
    minX: minX - inflateBy,
    maxX: maxX + inflateBy,
    minY: minY - inflateBy,
    maxY: maxY + inflateBy,
  };
}

/**
 * Test whether two axis-aligned bounding boxes intersect.
 */
function aabbIntersects(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Cluster pending voicings by inflated-AABB pairwise overlap using union-find.
 * Returns an array of clusters; each cluster is an array of indices into
 * `pendingVoicings`. Singletons (no overlap) appear as single-element arrays.
 */
function detectOverlapClusters(
  pendingVoicings: { rawVertices: ChordConnectorVertex[]; canonicalKey: string }[],
  baseRadius: number,
  maxBucketOffset: number,
): number[][] {
  const n = pendingVoicings.length;
  const inflate = baseRadius + maxBucketOffset;

  // Precompute inflated AABBs.
  const boxes = pendingVoicings.map((pv) => inflatedAABB(pv.rawVertices, inflate));

  // Union-find arrays.
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array<number>(n).fill(0);

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!; // path compression (halving)
      x = parent[x]!;
    }
    return x;
  }

  function union(x: number, y: number): void {
    const rx = find(x);
    const ry = find(y);
    if (rx === ry) return;
    if (rank[rx]! < rank[ry]!) {
      parent[rx] = ry;
    } else if (rank[rx]! > rank[ry]!) {
      parent[ry] = rx;
    } else {
      parent[ry] = rx;
      rank[rx] = rank[rx]! + 1;
    }
  }

  // Union all overlapping pairs.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (aabbIntersects(boxes[i]!, boxes[j]!)) {
        union(i, j);
      }
    }
  }

  // Collect clusters by root.
  const clusterMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    let cluster = clusterMap.get(root);
    if (!cluster) {
      cluster = [];
      clusterMap.set(root, cluster);
    }
    cluster.push(i);
  }

  return Array.from(clusterMap.values());
}

/**
 * Assign offsets from OFFSET_BUCKET to each voicing based on its cluster.
 * Within each cluster, members are sorted by canonicalKey (lexicographic) for
 * determinism, then assigned OFFSET_BUCKET[i % OFFSET_BUCKET.length].
 * Singleton clusters (no overlap) receive offset 0.
 * Returns a Map<canonicalKey, offsetPx>.
 */
function assignClusterOffsets(
  clusters: number[][],
  pendingVoicings: { canonicalKey: string }[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      result.set(pendingVoicings[cluster[0]!]!.canonicalKey, 0);
    } else {
      // Sort by canonicalKey for determinism.
      const sorted = [...cluster].sort((a, b) =>
        pendingVoicings[a]!.canonicalKey.localeCompare(pendingVoicings[b]!.canonicalKey),
      );
      sorted.forEach((idx, i) => {
        result.set(pendingVoicings[idx]!.canonicalKey, OFFSET_BUCKET[i % OFFSET_BUCKET.length]!);
      });
    }
  }
  return result;
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
 *   path is built by `offsetOutlinePath(polarSort(vertices), r)` where
 *   `r = stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR + offsetPx`,
 *   which Minkowski-sums the polygon with a disk to produce a rounded contour:
 *   smooth blob for non-collinear triads (eliminates thin-sliver artifacts on
 *   cross-fret voicings), capsule fallback for exactly-collinear inputs.
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
 *         `offsetPx` from OFFSET_BUCKET (2 px spacing). Voicings that do not
 *         overlap any other voicing receive offset 0. Finally the pending list
 *         is iterated once more to emit final paths via
 *         `offsetOutlinePath(polarSort(rawVertices), baseRadius + offsetPx)`.
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
 *                        radius (`stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR`).
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

      // Compute palette index from the bass-note interval (semitones from
      // chord root). Same inversion → same color across positions and chord
      // qualities. Root in bass = 0 → palette[0]; major 3rd in bass = 4 →
      // palette[4]; perfect 5th in bass = 7 → palette[7]; etc.
      const paletteIndex = bassIntervalSemitones(bestCombo, chordRoot) % 8;

      // Collect — path generation deferred to pass 2 after cluster assignment.
      pendingVoicings.push({ rawVertices, paletteIndex, canonicalKey });
    }
  }

  // Pass 2: cluster + assign offsets, then emit final voicings with paths.
  //
  // `detectOverlapClusters` groups voicings whose inflated AABBs intersect
  // via union-find (AABB inflated by baseRadius + maxBucketOffset so the test
  // approximates envelope-vs-envelope overlap, not just vertex proximity).
  // `assignClusterOffsets` sorts each cluster by canonicalKey and assigns
  // OFFSET_BUCKET[i % OFFSET_BUCKET.length] to member i — singletons get 0.
  //
  // `offsetOutlinePath` Minkowski-sums the polar-sorted polygon with a disk of
  // radius `baseRadius + offsetPx` and dispatches internally:
  //   - 3+ non-collinear vertices → rounded offset polygon (smooth blob,
  //     fixes thin-sliver triangles for cross-fret triads).
  //   - 3+ collinear vertices → falls back to a capsule (matches old look).
  //   - 2 vertices → capsule.
  //   - 1 vertex → circle.
  // fill === outline (byte-identical) — renderer differentiates via fill/stroke.
  const baseRadius = stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR;
  const maxBucketOffset = OFFSET_BUCKET[OFFSET_BUCKET.length - 1]!; // 10
  const clusters = detectOverlapClusters(pendingVoicings, baseRadius, maxBucketOffset);
  const clusterOffsetMap = assignClusterOffsets(clusters, pendingVoicings);

  const results: ChordConnectorVoicing[] = pendingVoicings.map((pv) => {
    const offsetPx = clusterOffsetMap.get(pv.canonicalKey) ?? 0;
    const radius = clampConnectorRadiusToYBounds(
      pv.rawVertices,
      baseRadius + offsetPx,
      yBounds,
    );
    const pathStr = offsetOutlinePath(
      convexHull(pv.rawVertices),
      radius,
    );
    const paths = { fill: pathStr, outline: pathStr };
    return { paths, vertices: pv.rawVertices, paletteIndex: pv.paletteIndex, voicingKey: pv.canonicalKey };
  });

  return results;
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
        yBounds,
      ),
    [noteData, chordToneNames, fretCenterX, stringYAt, stringRowPx, chordRoot, yBounds],
  );
}
