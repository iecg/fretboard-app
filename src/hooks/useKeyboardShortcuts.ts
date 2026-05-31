import { useEffect } from "react";
import { useStore } from "jotai";
import { scaleVisibleAtom } from "../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../store/chordOverlayAtoms";
import {
  progressionPlayingAtom,
  setProgressionPlayingAtom,
  stopProgressionPlaybackAtom,
} from "../store/progressionAtoms";

export function useKeyboardShortcuts() {
  const store = useStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          store.set(
            setProgressionPlayingAtom,
            !store.get(progressionPlayingAtom),
          );
          break;
        case ".":
          e.preventDefault();
          store.set(stopProgressionPlaybackAtom);
          break;
        case "s":
        case "S":
          e.preventDefault();
          store.set(scaleVisibleAtom, !store.get(scaleVisibleAtom));
          break;
        case "c":
        case "C":
          e.preventDefault();
          store.set(chordOverlayHiddenAtom, !store.get(chordOverlayHiddenAtom));
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);
}
