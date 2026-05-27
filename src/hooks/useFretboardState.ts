import { useFretboardTopologyModel } from "./useFretboardTopologyModel";

export type { ActiveShapeType } from "./useFretboardTopologyModel";

/**
 * Thin compatibility wrapper around {@link useFretboardTopologyModel}.
 *
 * Topology and playback concerns are split: this hook (and its underlying
 * topology model) intentionally subscribes only to atoms that affect the
 * static fretboard layout / overlay state. Playback-only atoms are consumed
 * separately via `useFretboardPlaybackSnapshot` so that timeline / tempo
 * changes do not invalidate the topology subtree.
 */
export function useFretboardState() {
  return useFretboardTopologyModel();
}
