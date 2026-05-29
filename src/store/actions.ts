import { atom } from "jotai";
import { RESET } from "jotai/utils";
import { STORAGE_PREFIX } from "../utils/storage";
import {
  rootNoteAtom,
  baseScaleNameAtom,
  scaleNameAtom,
  scaleVisibleAtom,
  accidentalModeAtom,
} from "./scaleAtoms";
import {
  chordOverlayHiddenAtom,
  linkChordRootAtom,
} from "./chordOverlayAtoms";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  npsOctaveAtom,
} from "./fingeringAtoms";
import {
  loadedPresetIdAtom,
  remapProgressionStepsForScaleAtom,
  resetProgressionAtomsAtom,
} from "./progressionAtoms";
import {
  displayFormatAtom,
  scaleDegreeColorsEnabledAtom,
  themeAtom,
} from "./uiAtoms";
import {
  tuningNameAtom,
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
} from "./layoutAtoms";
import {
  enharmonicDisplayAtom,
  isMutedAtom,
} from "./audioAtoms";

/**
 * Action wrapper around `fingeringPatternAtom`. Use this instead of writing
 * fingeringPatternAtom directly from UI code.
 */
export const setFingeringPatternAtom = atom(
  null,
  (_get, set, pattern: import("./fingeringAtoms").FingeringPattern) => {
    set(fingeringPatternAtom, pattern);
  },
);

export const setRootNoteAtom = atom(null, (_get, set, note: string) => {
  set(rootNoteAtom, note);
});

/**
 * Action wrapper around `scaleNameAtom` that delegates progression-step
 * degree remapping to `remapProgressionStepsForScaleAtom`. The legacy
 * standalone `chordDegreeAtom` is gone — degree state lives on progression
 * steps now.
 *
 * Direct writes to `scaleNameAtom` bypass this remap — useful in tests that
 * want to assert atom-layer behavior without cross-domain coupling. UI paths
 * (TheoryControls / Circle of Fifths) flow through this
 * action via `useScaleState`.
 */
export const setScaleNameAtom = atom(null, (get, set, value: string) => {
  const prevScale = get(scaleNameAtom);
  set(scaleNameAtom, value);
  const newScale = get(scaleNameAtom); // normalized via scaleNameAtom write
  if (newScale === prevScale) return;
  set(remapProgressionStepsForScaleAtom, newScale);
  set(loadedPresetIdAtom, null);
});

export const resetAtom = atom(null, (_get, set) => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch {
    // Silent fail if storage is blocked; atoms are still reset in-memory.
  }
  set(rootNoteAtom, RESET);
  set(baseScaleNameAtom, RESET);
  set(scaleVisibleAtom, RESET);
  set(chordOverlayHiddenAtom, RESET);
  set(linkChordRootAtom, RESET);
  set(resetProgressionAtomsAtom);
  set(fingeringPatternAtom, RESET);
  set(cagedShapesAtom, RESET);
  set(npsPositionAtom, RESET);
  set(npsOctaveAtom, RESET);
  set(displayFormatAtom, RESET);
  set(scaleDegreeColorsEnabledAtom, RESET);
  set(tuningNameAtom, RESET);
  set(fretZoomAtom, RESET);
  set(fretStartAtom, RESET);
  set(fretEndAtom, RESET);
  set(accidentalModeAtom, "auto");
  set(enharmonicDisplayAtom, "auto");
  set(isMutedAtom, RESET);
  set(themeAtom, RESET);
});
