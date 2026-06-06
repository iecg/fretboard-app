import { useMemo } from "react";
import type { NoteData } from "./useNoteData";
import { type CagedShape } from "@fretflow/core";

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

interface ChordConnectorVertex {
  x: number;
  y: number;
}

/**
 * A single playable voicing returned by the chord-connector hook.
 */
export interface ChordConnectorVoicing {
  /**
   * Solid center line through the voicing notes in string order — the
   * connector's spine, drawn under the note markers. This is the only
   * geometry the connector renders (spine-only).
   */
  spinePath: string;
  /**
   * 0–7, deterministic per shape identity; same fingering at any neck position
   * yields same index. Used to index into --chord-connector-color-N CSS tokens.
   */
  paletteIndex: number;
  /** Redundant dash cue — true when this voicing was assigned a dashed style. */
  dashed: boolean;
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
  dashed: boolean;
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
 * Ordered palette slots used to color conflicting voicings, expressed as
 * 0-based indices (the render layer adds 1 → 1-based --chord-connector-color-N).
 * Order is chosen for contrast on the wood neck in both themes; slot 8 (yellow,
 * index 7) and slot 3 (gray, index 2) are skipped as low-contrast on light wood.
 * Resulting CSS slots in order: 1,6,4,7,2,5 → orange, blue, green, purple,
 * vermillion, sky. Clusters needing more than 6 colors wrap modulo.
 */
export const CONNECTOR_PALETTE_ROTATION = [0, 5, 3, 6, 1, 4] as const;

/**
 * Maximum distance, in normalized (fret, string) units, at which two spines
 * are treated as conflicting. 0 covers crossings and shared notes; the small
 * positive slack also catches near-misses. Approximate in pixel terms (fret
 * and string axes differ in px), but crossings are exact and the metric is
 * screen-independent so assigned colors stay stable across resize.
 */
const CONFLICT_THRESHOLD_UNITS = 0.6;

interface ConnectorEncoding {
  /** 0-based palette index; render adds 1 for the 1-based CSS slot. */
  paletteIndex: number;
  /** Redundant second cue — dashed when the assigned color slot is odd. */
  dashed: boolean;
}

/**
 * Assign each voicing a distinct visual encoding (color + dash) so overlapping
 * spines stay distinguishable. Builds a conflict graph — two voicings conflict
 * when their spines cross, share a note, or pass within CONFLICT_THRESHOLD_UNITS
 * — then greedy-colors it (deterministically, ordered by canonicalKey). The
 * color slot maps through CONNECTOR_PALETTE_ROTATION; dash follows slot parity.
 *
 * Operates on normalized (fret, string) coordinates via the pure geometry
 * helpers, so the result is screen-independent: it lives in the topology stage
 * and does not change on resize.
 */
export function assignConflictEncodings(
  voicings: ReadonlyArray<{
    canonicalKey: string;
    noteCoords: NormalizedChordConnectorVertex[];
  }>,
): Map<string, ConnectorEncoding> {
  const result = new Map<string, ConnectorEncoding>();
  const polylines = voicings.map((v) =>
    v.noteCoords.map((c) => ({ x: c.fretIndex, y: c.stringIndex })),
  );
  const n = voicings.length;
  const conflicts = voicings.map(() => new Set<number>());
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (polylineDistance(polylines[i]!, polylines[j]!) <= CONFLICT_THRESHOLD_UNITS) {
        conflicts[i]!.add(j);
        conflicts[j]!.add(i);
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    voicings[a]!.canonicalKey.localeCompare(voicings[b]!.canonicalKey),
  );

  const slotByIndex = new Map<number, number>();
  for (const idx of order) {
    const used = new Set<number>();
    for (const neighbor of conflicts[idx]!) {
      const slot = slotByIndex.get(neighbor);
      if (slot !== undefined) used.add(slot);
    }
    let slot = 0;
    while (used.has(slot)) slot++;
    slotByIndex.set(idx, slot);
    result.set(voicings[idx]!.canonicalKey, {
      paletteIndex:
        CONNECTOR_PALETTE_ROTATION[slot % CONNECTOR_PALETTE_ROTATION.length]!,
      dashed: slot % 2 === 1,
    });
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
  "chord-root-outside",
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
 * **Return shape (per voicing):** each voicing carries a `spinePath` — the
 * solid center line through the voicing notes in string order — plus its
 * `{paletteIndex, dashed}` encoding, `shape`, `voicingKey`, and `isFallback`
 * flag. The spine is the only rendered geometry; there is no fill/outline.
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
 *   5. Two-pass generation:
 *      a. **Collect pass** — the main loop pushes `{noteCoords, canonicalKey}`
 *         to a `pendingVoicings` list (topology only, no pixels).
 *      b. **Encode + assign pass** — after the loop, `assignConflictEncodings`
 *         builds a conflict graph (crossing / shared-note / proximity) and
 *         greedy-colors it, mapping each `canonicalKey` to a `{paletteIndex,
 *         dashed}` encoding so overlapping spines stay distinguishable. The
 *         pixel stage then maps coords to SVG points and emits each spine.
 *
 * Returns an array of voicing objects, one per distinct playable voicing.
 * Returns [] when N < 2 or no valid voicing can be assembled.
 *
 * @param noteData        Shape-aware note data from useNoteData (note-inactive already
 *                        marks positions outside the active CAGED/3NPS shape).
 * @param chordToneNames  The N distinct chord-tone note names expected in each voicing
 *                        (e.g. ["C","E","G"] for C major). Order does not matter.
 * @param fretCenterX     Maps fretIndex → SVG x coordinate.
 * @param stringYAt       Maps (stringIndex, x) → SVG y coordinate.
 */
export function buildChordConnectorPolylines(
  noteData: NoteData[],
  chordToneNames: string[],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
): ChordConnectorVoicing[] {
  const pending = buildPendingChordConnectorVoicings({ noteData, chordToneNames });
  return buildPixelChordConnectorVoicings({ pendingVoicings: pending, fretCenterX, stringYAt });
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
 * Pure topology stage — discovers playable voicings and assigns conflict
 * encodings (color + dash) without any pixel geometry.
 *
 * For generated voicings: runs the window-scan / filtering / dedupe algorithm,
 * collects `noteCoords` (fret/string indices), then calls `assignConflictEncodings`
 * on the normalized (fret, string) coordinates so the O(N²) conflict graph only
 * runs when musical data changes — not on every resize.
 *
 * For explicit voicings: builds sourceCombo, canonicalKey, voicingKey, noteCoords,
 * shape from the supplied voicing descriptors, then layers on the
 * `{paletteIndex, dashed}` encoding from `assignConflictEncodings`.
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
    const base = explicitVoicings.map((voicing) => {
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
        shape: voicing.shape,
        isFallback: voicing.isFallback,
      };
    });

    const encodings = assignConflictEncodings(base);
    return base.map((pv) => ({
      ...pv,
      ...(encodings.get(pv.canonicalKey) ?? { paletteIndex: 0, dashed: false }),
    }));
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
  const collected: Omit<PendingChordConnectorVoicing, "paletteIndex" | "dashed">[] = [];

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
        shape: undefined,
      });
    }
  }

  if (collected.length === 0) return [];

  const encodings = assignConflictEncodings(collected);
  return collected.map((pv) => ({
    ...pv,
    ...(encodings.get(pv.canonicalKey) ?? { paletteIndex: 0, dashed: false }),
  }));
}

function finalizeChordConnectorPolylines(
  pendingVoicings: Array<{
    rawVertices: ChordConnectorVertex[];
    paletteIndex: number;
    dashed: boolean;
    shape?: CagedShape;
    voicingKey: string;
    isFallback?: boolean;
  }>,
): ChordConnectorVoicing[] {
  if (pendingVoicings.length === 0) return [];

  return pendingVoicings.map((pv) => {
    // Spine: solid center line through the voicing notes in string order.
    const spinePath = pv.rawVertices.length === 0
      ? ""
      : "M " + pv.rawVertices
          .map((v) => `${Math.round(v.x * 100) / 100} ${Math.round(v.y * 100) / 100}`)
          .join(" L ");
    return {
      spinePath,
      paletteIndex: pv.paletteIndex,
      dashed: pv.dashed,
      shape: pv.shape,
      voicingKey: pv.voicingKey,
      isFallback: pv.isFallback,
    };
  });
}

/**
 * Pixel geometry stage — maps `noteCoords` to pixel vertices using the
 * supplied geometry helpers, then emits each voicing's spine via
 * `finalizeChordConnectorPolylines`. Only re-runs when geometry helpers or the
 * pending voicings themselves change.
 */
export function buildPixelChordConnectorVoicings({
  pendingVoicings,
  fretCenterX,
  stringYAt,
}: {
  pendingVoicings: PendingChordConnectorVoicing[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
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

  return finalizeChordConnectorPolylines(withPixelVerts);
}

export interface UseChordConnectorPolylinesParams {
  noteData: NoteData[];
  chordToneNames: string[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
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
 * 2. **Pixel memo** — depends on `pendingVoicings`, `fretCenterX`, `stringYAt`.
 *    Maps normalized fret/string coords to pixel positions and emits each
 *    voicing's spine. Re-runs on resize without touching the conflict graph.
 *
 * Returns `ChordConnectorVoicing[]` — one entry per distinct playable voicing.
 */
export function useChordConnectorPolylines({
  noteData,
  chordToneNames,
  fretCenterX,
  stringYAt,
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
      }),
    [pendingVoicings, fretCenterX, stringYAt],
  );
}
