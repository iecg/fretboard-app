import { atom } from "jotai";
import { RESET } from "jotai/utils";
import { STORAGE_PREFIX } from "../utils/storage";
import { remapDegreeForScale, type DegreeId } from "@fretflow/core";
import {
  rootNoteAtom,
  baseScaleNameAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  scaleVisibleAtom,
  accidentalModeAtom,
} from "./scaleAtoms";
import {
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordRootAtom,
  chordTypeAtom,
  chordRootOverrideAtom,
  chordQualityOverrideAtom,
  chordOverlayHiddenAtom,
  linkChordRootAtom,
  chordFretSpreadAtom,
  practiceLensAtom,
} from "./chordOverlayAtoms";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  npsOctaveAtom,
} from "./fingeringAtoms";
import {
  displayFormatAtom,
  scaleDegreeColorsEnabledAtom,
  mobileTabAtom,
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
 * Action wrapper around `fingeringPatternAtom` that auto-clears the active
 * chord degree when the new pattern is `one-string` or `two-strings`.
 * This prevents the degree overlay from remaining active on patterns where
 * chord overlay is disabled. Use this instead of writing fingeringPatternAtom
 * directly from UI code.
 */
export const setFingeringPatternAtom = atom(
  null,
  (_get, set, pattern: import("./fingeringAtoms").FingeringPattern) => {
    set(fingeringPatternAtom, pattern);
    if (pattern === "one-string" || pattern === "two-strings") {
      set(chordDegreeAtom, null);
    }
  },
);

export const setRootNoteAtom = atom(null, (get, set, note: string) => {
  set(rootNoteAtom, note);
  // In degree mode the derived chordRootAtom/chordTypeAtom auto-resolve via
  // getDiatonicChord against the new rootNote — no explicit sync needed.
  // Writing through chordRootAtom would force mode→manual, collapsing the
  // chord-follows-the-scale contract. Sync only matters in manual mode.
  if (get(chordOverlayModeAtom) === "degree") return;
  if (get(linkChordRootAtom)) set(chordRootAtom, note);
});

/**
 * Action wrapper around `scaleNameAtom` that remaps the active chord degree
 * across mode changes by semitone-equivalence. Example: switching from
 * A Ionian (Major) to A Dorian with degree="I" remaps to "i" (semitone 0
 * in Dorian, lowercase because Dorian's tonic triad is minor).
 *
 * Direct writes to `scaleNameAtom` bypass this remap — useful in tests that
 * want to assert atom-layer behavior without cross-domain coupling. UI paths
 * (TheoryControls / ScaleSelector / Circle of Fifths) flow through this
 * action via `useScaleState`.
 */
export const setScaleNameAtom = atom(null, (get, set, value: string) => {
  const prevScale = get(scaleNameAtom);
  set(scaleNameAtom, value);
  const newScale = get(scaleNameAtom); // normalized via scaleNameAtom write
  if (newScale === prevScale) return;
  const oldDegree = get(chordDegreeAtom);
  if (!oldDegree) return;
  const remapped = remapDegreeForScale(oldDegree, prevScale, newScale);
  if (remapped !== oldDegree) {
    set(chordDegreeAtom, remapped as DegreeId | null);
  }
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
  set(scaleBrowseModeAtom, RESET);
  set(scaleVisibleAtom, RESET);
  set(chordRootAtom, RESET);
  set(chordTypeAtom, RESET);
  set(chordDegreeAtom, RESET);
  set(chordOverlayModeAtom, RESET);
  set(chordRootOverrideAtom, RESET);
  set(chordQualityOverrideAtom, RESET);
  set(chordOverlayHiddenAtom, RESET);
  set(linkChordRootAtom, RESET);
  set(chordFretSpreadAtom, RESET);
  set(practiceLensAtom, RESET);
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
  set(mobileTabAtom, RESET);
  set(themeAtom, RESET);
});
