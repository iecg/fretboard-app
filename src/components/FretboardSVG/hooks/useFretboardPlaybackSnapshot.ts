import { useAtomValue } from "jotai";
import { progressionPlayingAtom } from "../../../store/progressionAtoms";

export interface FretboardPlaybackSnapshot {
  playing: boolean;
}

export function useFretboardPlaybackSnapshot(
  enabled: boolean,
): FretboardPlaybackSnapshot | null {
  const playing = useAtomValue(progressionPlayingAtom);
  if (!enabled || !playing) return null;
  return { playing };
}
