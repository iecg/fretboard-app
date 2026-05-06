import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  CAGED_SHAPES,
  type CagedShape,
} from "../shapes";
import {
  k,
  createStorage,
  constrainedNumberStorage,
  GET_ON_INIT,
} from "../utils/storage";

export type FingeringPattern =
  | "none"
  | "caged"
  | "3nps"
  | "one-string"
  | "two-strings"
  | "double-stops"
  | "box-2x4"
  | "box-3x3"
  | "stack";

const cagedShapesStorage = createStorage<Set<CagedShape>>({
  serialize: (s) => JSON.stringify(Array.from(s)),
  deserialize: (v) => new Set(JSON.parse(v) as CagedShape[]),
});

const npsPositionStorage = constrainedNumberStorage({ min: 1, max: 7, integer: true });
const npsOctaveStorage = constrainedNumberStorage({ min: 0, max: 1, integer: true });

const fingeringPatternStorage = createStorage<FingeringPattern>({
  onRead: (v) => (v === ("all" as FingeringPattern) ? "none" : v),
});

export const fingeringPatternAtom = atomWithStorage<FingeringPattern>(
  k("fingeringPattern"),
  "none",
  fingeringPatternStorage,
  GET_ON_INIT,
);

export const cagedShapesAtom = atomWithStorage<Set<CagedShape>>(
  k("cagedShapes"),
  new Set(CAGED_SHAPES),
  cagedShapesStorage,
  GET_ON_INIT,
);

export const toggleCagedShapeAtom = atom(null, (get, set, shape: CagedShape) => {
  const prev = get(cagedShapesAtom);
  const next = new Set(prev);
  if (next.has(shape)) {
    if (next.size > 1) next.delete(shape);
  } else {
    next.add(shape);
  }
  set(cagedShapesAtom, next);
});

export const selectSingleCagedShapeAtom = atom(
  null,
  (_get, set, shape: CagedShape) => {
    set(cagedShapesAtom, new Set([shape]));
  },
);

export const npsPositionAtom = atomWithStorage(
  k("npsPosition"),
  1,
  npsPositionStorage,
  GET_ON_INIT,
);

export const npsOctaveAtom = atomWithStorage(
  k("npsOctave"),
  0,
  npsOctaveStorage,
  GET_ON_INIT,
);

export const clickedShapeAtom = atom<CagedShape | null>(null);
export const recenterKeyAtom = atom<number>(0);
