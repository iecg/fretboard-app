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
  | "two-strings";

const cagedShapesStorage = createStorage<Set<CagedShape>>({
  serialize: (s) => JSON.stringify(Array.from(s)),
  deserialize: (v) => new Set(JSON.parse(v) as CagedShape[]),
});

const npsPositionStorage = constrainedNumberStorage({ min: 1, max: 7, integer: true });
const npsOctaveStorage = constrainedNumberStorage({ min: 0, max: 1, integer: true });

const fingeringPatternStorage = createStorage<FingeringPattern>({
  onRead: (v) => {
    const LEGACY = new Set(["all", "double-stops", "box-2x4", "box-3x3", "stack"]);
    return LEGACY.has(v as string) ? "none" : v;
  },
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

// one-string sub-controls
export const oneStringIndexAtom = atomWithStorage(
  k("oneString.index"),
  0,
  constrainedNumberStorage({ min: 0, max: 5, integer: true }),
  GET_ON_INIT,
);

// two-strings sub-controls
export const twoStringsPairAtom = atomWithStorage(
  k("twoStrings.pair"),
  0,
  constrainedNumberStorage({ min: 0, max: 4, integer: true }),
  GET_ON_INIT,
);

// two-strings interval sub-control (0 = Off, 1-3 = 3rds/4ths/5ths)
// max was 4 (6ths) — UAT-13 drops 6ths; constrainedNumberStorage clamps persisted 4 → 3.
export const twoStringsIntervalAtom = atomWithStorage(
  k("twoStrings.interval"),
  0,
  constrainedNumberStorage({ min: 0, max: 3, integer: true }),
  GET_ON_INIT,
);

