import { useEffect } from "react";
import { useStore } from "jotai";
import { scaleVisibleAtom } from "@fretflow/fretboard/store/scaleAtoms";
import { chordOverlayHiddenAtom } from "@fretflow/fretboard/store/chordOverlayAtoms";
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
} from "@fretflow/fretboard/store/progressionAtoms";
// New state code imports atoms from the package surface directly, not the
// thin src/store re-export stubs (see AGENTS.md).
import {
  progressionStepsAtom,
  activeProgressionStepIndexAtom,
  reorderProgressionStepsAtom,
} from "@fretflow/fretboard/store/progressionAtoms";
import { inspectorActiveTabAtom } from "../store/inspectorAtoms";
import { toggleMuteAtom } from "@fretflow/fretboard/store/audioAtoms";
import {
  MIN_PROGRESSION_TEMPO_BPM,
  MAX_PROGRESSION_TEMPO_BPM,
} from "@fretflow/fretboard/progressions/progressionDomain";
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

/** True when keyboard focus is currently inside the chord list — in which case
 * the list's own ←/→ handler owns navigation and the global one must stand down
 * (the window listener fires regardless of React's stopPropagation). */
function focusInsideChordList() {
  const list = document.getElementById(PROGRESSION_STEP_LIST_ID);
  return !!list && list.contains(document.activeElement);
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
      // Alt+Up/Down reorders the active step within the sequence (Option+Up/Down
      // on macOS). Up = earlier, Down = later — matching the vertical editor list.
      // We deliberately use the vertical axis, not Alt+Left/Right: Chrome on
      // Windows/Linux binds Alt+Left/Right to history back/forward, which we must
      // not hijack. Runs before the modifier early-return below (which otherwise
      // drops all alt combos), and always preventDefaults the handled combo.
      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const steps = store.get(progressionStepsAtom);
        const from = store.get(activeProgressionStepIndexAtom);
        const to = from + (e.key === "ArrowUp" ? -1 : 1);
        if (from >= 0 && from < steps.length && to >= 0 && to < steps.length) {
          store.set(reorderProgressionStepsAtom, { from, to });
        }
        return;
      }
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
          if (store.get(progressionPlayingAtom) || focusInsideChordList()) return;
          e.preventDefault();
          store.set(previousProgressionStepAtom);
          focusShortcutTarget(PROGRESSION_STEP_LIST_ID);
          break;
        case "ArrowRight":
          if (store.get(progressionPlayingAtom) || focusInsideChordList()) return;
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
