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
      // Disabled during playback — the step index advances automatically
      // and manual nudging would conflict with the audio timeline.
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
      try {
        navigator.mediaSession.setActionHandler(
          action as MediaSessionAction,
          handler,
        );
      } catch {
        // Some browsers throw for unsupported-but-valid action types;
        // swallow so remaining handlers still register.
      }
    }

    return () => {
      if (!("mediaSession" in navigator) || !navigator.mediaSession) return;
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(
            action as MediaSessionAction,
            null,
          );
        } catch {
          // Same guard as above — non-fatal if an action is unknown.
        }
      }
    };
  }, [store]);
}
