import { useEffect } from "react";
import { useStore } from "jotai";
import {
  progressionPlayingAtom,
  setProgressionPlayingAtom,
  stopProgressionPlaybackAtom,
  previousProgressionStepAtom,
  advanceProgressionPlaybackAtom,
} from "../store/progressionAtoms";

export function useMediaSession() {
  const store = useStore();

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: "FretFlow",
      artist: "",
      album: "",
    });

    const handlers: [string, () => void][] = [
      ["play", () => store.set(setProgressionPlayingAtom, true)],
      ["pause", () => store.set(setProgressionPlayingAtom, false)],
      ["stop", () => store.set(stopProgressionPlaybackAtom)],
      [
        "previoustrack",
        () => {
          if (!store.get(progressionPlayingAtom)) {
            store.set(previousProgressionStepAtom);
          }
        },
      ],
      [
        "nexttrack",
        () => {
          if (!store.get(progressionPlayingAtom)) {
            store.set(advanceProgressionPlaybackAtom);
          }
        },
      ],
    ];

    for (const [action, handler] of handlers) {
      navigator.mediaSession.setActionHandler(
        action as MediaSessionAction,
        handler,
      );
    }

    return () => {
      if (!("mediaSession" in navigator) || !navigator.mediaSession) return;
      for (const [action] of handlers) {
        navigator.mediaSession.setActionHandler(
          action as MediaSessionAction,
          null,
        );
      }
    };
  }, [store]);
}
