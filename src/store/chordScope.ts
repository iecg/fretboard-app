import { atom } from "jotai";
import { cagedShapesAtom, fingeringPatternAtom, npsPositionAtom } from "./fingeringAtoms";

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
