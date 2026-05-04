import { useMemo } from "react";
import type { NoteData } from "./useNoteData";

export interface ChordConnectorVertex {
  x: number;
  y: number;
}

/**
 * Maximum fret distance between two MST-connected positions before the edge is
 * pruned. A span > 5 frets indicates two unrelated voicing regions; connecting
 * them with one line would cross the entire neck.
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

interface ConnectorNode {
  x: number;
  y: number;
  fretIndex: number;
}

/**
 * Pure function — no React dependency required. Exported for direct unit testing.
 *
 * Accepts a filtered `NoteData[]` array (already shape-aware: notes outside the
 * active CAGED/3NPS shape have noteClass "note-inactive" and are excluded by the
 * caller).  Filters to chord-tone roles, maps each to an SVG vertex, then runs
 * Prim's Minimum Spanning Tree algorithm over Euclidean distance in pixel space.
 * After MST construction, any edge whose fret-distance exceeds MAX_FRET_SPAN is
 * pruned (avoids cross-neck lines on spread voicings).
 *
 * Returns an array of 2-vertex polylines, one per MST edge.
 * Returns [] when fewer than 2 eligible positions are found.
 */
export function buildChordConnectorPolylines(
  noteData: NoteData[],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
): ChordConnectorVertex[][] {
  // Step 1: Collect chord-tone nodes that are not filtered out by shape constraints.
  // noteClass "note-inactive" means outside the active shape — skip them.
  const nodes: ConnectorNode[] = [];
  for (const nd of noteData) {
    if (nd.noteClass === "note-inactive") continue;
    if (!CHORD_TONE_CLASSES.has(nd.noteClass)) continue;
    const x = fretCenterX(nd.fretIndex);
    const y = stringYAt(nd.stringIndex, x);
    nodes.push({ x, y, fretIndex: nd.fretIndex });
  }

  if (nodes.length < 2) return [];

  const n = nodes.length;

  // Step 2: Prim's MST over the complete graph using Euclidean distance.
  // inMST[i] = true once node i is included in the growing tree.
  // minDist[i] = minimum Euclidean distance from node i to any node already in the tree.
  // nearest[i] = index of the tree node closest to node i.
  const inMST = new Array<boolean>(n).fill(false);
  const minDist = new Array<number>(n).fill(Infinity);
  const nearest = new Array<number>(n).fill(-1);

  // Start from node 0.
  minDist[0] = 0;

  const edges: Array<[number, number]> = [];

  for (let step = 0; step < n; step++) {
    // Pick the non-MST node with the smallest minDist.
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!inMST[i] && (u === -1 || minDist[i] < minDist[u])) {
        u = i;
      }
    }
    inMST[u] = true;

    // Record the MST edge (skip root node which has no parent).
    if (nearest[u] !== -1) {
      edges.push([u, nearest[u]]);
    }

    // Update distances for all remaining non-MST nodes.
    const nu = nodes[u]!;
    for (let v = 0; v < n; v++) {
      if (inMST[v]) continue;
      const nv = nodes[v]!;
      const dx = nu.x - nv.x;
      const dy = nu.y - nv.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist[v]) {
        minDist[v] = dist;
        nearest[v] = u;
      }
    }
  }

  // Step 3: Post-prune edges whose fret span exceeds MAX_FRET_SPAN.
  // This removes connections across implausibly large neck regions (e.g., two
  // separate chord positions separated by an open string).
  const polylines: ChordConnectorVertex[][] = [];
  for (const [a, b] of edges) {
    const na = nodes[a]!;
    const nb = nodes[b]!;
    if (Math.abs(na.fretIndex - nb.fretIndex) <= MAX_FRET_SPAN) {
      polylines.push([
        { x: na.x, y: na.y },
        { x: nb.x, y: nb.y },
      ]);
    }
  }

  return polylines;
}

export interface UseChordConnectorPolylinesParams {
  noteData: NoteData[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
}

/**
 * React hook that memoizes `buildChordConnectorPolylines` output.
 * Re-runs only when noteData or geometry helpers change.
 */
export function useChordConnectorPolylines({
  noteData,
  fretCenterX,
  stringYAt,
}: UseChordConnectorPolylinesParams): ChordConnectorVertex[][] {
  return useMemo(
    () => buildChordConnectorPolylines(noteData, fretCenterX, stringYAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteData],
  );
}
