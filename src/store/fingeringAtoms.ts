import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  CAGED_SHAPES,
  type CagedShape,
} from "../shapes";
import {
  k,
  createStorage,
  rawStringStorage,
  constrainedNumberStorage,
  GET_ON_INIT,
} from "../utils/storage";

export type FingeringPattern = "all" | "caged" | "3nps";

const cagedShapesStorage = createStorage<Set<CagedShape>>({
  serialize: (s) => JSON.stringify(Array.from(s)),
  deserialize: (v) => new Set(JSON.parse(v) as CagedShape[]),
});

const npsPositionStorage = constrainedNumberStorage({ min: 1, max: 12, integer: true });

export const fingeringPatternAtom = atomWithStorage<FingeringPattern>(
  k("fingeringPattern"),
  "all",
  rawStringStorage<FingeringPattern>(),
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

export const clickedShapeAtom = atom<CagedShape | null>(null);
export const recenterKeyAtom = atom<number>(0);
