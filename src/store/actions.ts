import { atom } from "jotai";
import { RESET } from "jotai/utils";
import { STORAGE_PREFIX } from "../utils/storage";
import {
  rootNoteAtom,
  baseScaleNameAtom,
  scaleBrowseModeAtom,
  scaleVisibleAtom,
  accidentalModeAtom,
} from "./scaleAtoms";
import {
  chordRootAtom,
  chordTypeAtom,
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
  mobileTabAtom,
  tabletTabAtom,
  landscapeNarrowTabAtom,
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

export const setRootNoteAtom = atom(null, (get, set, note: string) => {
  set(rootNoteAtom, note);
  if (get(linkChordRootAtom)) set(chordRootAtom, note);
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
  set(linkChordRootAtom, RESET);
  set(chordFretSpreadAtom, RESET);
  set(practiceLensAtom, RESET);
  set(fingeringPatternAtom, RESET);
  set(cagedShapesAtom, RESET);
  set(npsPositionAtom, RESET);
  set(npsOctaveAtom, RESET);
  set(displayFormatAtom, RESET);
  set(tuningNameAtom, RESET);
  set(fretZoomAtom, RESET);
  set(fretStartAtom, RESET);
  set(fretEndAtom, RESET);
  set(accidentalModeAtom, "auto");
  set(enharmonicDisplayAtom, "auto");
  set(isMutedAtom, RESET);
  set(mobileTabAtom, RESET);
  set(tabletTabAtom, RESET);
  set(landscapeNarrowTabAtom, RESET);
});
