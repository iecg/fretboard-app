import { useEffect } from "react";
import { useStore } from "jotai";
import { scaleVisibleAtom } from "../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../store/chordOverlayAtoms";
import {
  progressionPlayingAtom,
  setProgressionPlayingAtom,
  stopProgressionPlaybackAtom,
  progressionLoopEnabledAtom,
  progressionChordEnabledAtom,
  progressionBassEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionMetronomeEnabledAtom,
  previousProgressionStepAtom,
  advanceProgressionPlaybackAtom,
} from "../store/progressionAtoms";
import { toggleMuteAtom } from "../store/audioAtoms";

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
        case "r":
        case "R":
          store.set(
            progressionLoopEnabledAtom,
            !store.get(progressionLoopEnabledAtom),
          );
          break;
        case "m":
        case "M":
          store.set(toggleMuteAtom);
          break;
        case "1":
          store.set(
            progressionChordEnabledAtom,
            !store.get(progressionChordEnabledAtom),
          );
          break;
        case "2":
          store.set(
            progressionBassEnabledAtom,
            !store.get(progressionBassEnabledAtom),
          );
          break;
        case "3":
          store.set(
            progressionDrumsEnabledAtom,
            !store.get(progressionDrumsEnabledAtom),
          );
          break;
        case "4":
          store.set(
            progressionMetronomeEnabledAtom,
            !store.get(progressionMetronomeEnabledAtom),
          );
          break;
        case "ArrowLeft":
          if (store.get(progressionPlayingAtom)) return;
          e.preventDefault();
          store.set(previousProgressionStepAtom);
          break;
        case "ArrowRight":
          if (store.get(progressionPlayingAtom)) return;
          e.preventDefault();
          store.set(advanceProgressionPlaybackAtom);
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
