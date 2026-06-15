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
  progressionTempoBpmAtom,
} from "../store/progressionAtoms";
import { inspectorActiveTabAtom } from "../store/inspectorAtoms";
import { toggleMuteAtom } from "../store/audioAtoms";
import {
  MIN_PROGRESSION_TEMPO_BPM,
  MAX_PROGRESSION_TEMPO_BPM,
} from "../progressions/progressionDomain";
import {
  TEMPO_STEPPER_ID,
  PROGRESSION_STEP_LIST_ID,
} from "../components/SongControls/progressionFocusIds";

/** Focus a shortcut target by id if it is currently rendered. A no-op when the
 * element is absent (e.g. its inspector tab is not showing) — the state mutation
 * has already happened, so we just skip moving focus. `preventScroll` keeps the
 * page and the list scrollport from jumping. */
function focusShortcutTarget(id: string) {
  document.getElementById(id)?.focus({ preventScroll: true });
}

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
          focusShortcutTarget(PROGRESSION_STEP_LIST_ID);
          break;
        case "ArrowRight":
          if (store.get(progressionPlayingAtom)) return;
          e.preventDefault();
          store.set(advanceProgressionPlaybackAtom);
          focusShortcutTarget(PROGRESSION_STEP_LIST_ID);
          break;
        case "ArrowUp":
          e.preventDefault();
          store.set(
            progressionTempoBpmAtom,
            Math.min(
              MAX_PROGRESSION_TEMPO_BPM,
              store.get(progressionTempoBpmAtom) + 5,
            ),
          );
          focusShortcutTarget(TEMPO_STEPPER_ID);
          break;
        case "ArrowDown":
          e.preventDefault();
          store.set(
            progressionTempoBpmAtom,
            Math.max(
              MIN_PROGRESSION_TEMPO_BPM,
              store.get(progressionTempoBpmAtom) - 5,
            ),
          );
          focusShortcutTarget(TEMPO_STEPPER_ID);
          break;
        case "t":
        case "T":
          e.preventDefault();
          store.set(
            inspectorActiveTabAtom,
            store.get(inspectorActiveTabAtom) === "view" ? "song" : "view",
          );
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
