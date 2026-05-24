import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { k, GET_ON_INIT, booleanStorage } from "../utils/storage";
import { cagedShapesAtom, fingeringPatternAtom, npsPositionAtom } from "./fingeringAtoms";

/**
 * The single, explicit fingering↔chord coupling: when on AND
 * `activePositionAtom` resolves true, the chord overlay (loose chord-tone
 * highlighting + voicing-engine output) is constrained to the active
 * fingering position's fret window. Default off.
 */
export const chordScopeToPositionAtom = atomWithStorage<boolean>(
  k("chordScopeToPosition"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

/**
 * True when the fingering mode resolves to a single, identifiable position:
 *   - `caged` with exactly one shape selected
 *   - `3nps` with a position > 0
 * `none`, multi-shape CAGED, and the String-study modes have no single
 * position — `activePositionAtom` is false in those cases.
 */
export const activePositionAtom = atom((get) => {
  const pattern = get(fingeringPatternAtom);
  if (pattern === "caged") return get(cagedShapesAtom).size > 0;
  if (pattern === "3nps") return get(npsPositionAtom) > 0;
  return false;
});
