import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { type CagedShape } from "@fretflow/core";
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

/**
 * Collapse a persisted (possibly multi-shape) CAGED selection to a single shape.
 * Prefers E (the default), else the first stored entry, else E. Enforces the
 * one-shape invariant for legacy storage written before single-shape mode.
 */
export function collapseToSingleShape(shapes: CagedShape[]): CagedShape {
  if (shapes.includes("E")) return "E";
  return shapes[0] ?? "E";
}

const cagedShapesStorage = createStorage<Set<CagedShape>>({
  serialize: (s) => JSON.stringify(Array.from(s)),
  deserialize: (v) => new Set<CagedShape>([collapseToSingleShape(JSON.parse(v) as CagedShape[])]),
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
  new Set<CagedShape>(["E"]),
  cagedShapesStorage,
  GET_ON_INIT,
);

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

// one-string interval sub-control (0 = Off, 1 = On — shows all 3rds + 4ths + 6ths simultaneously)
// Persisted values 2 or 3 from R06 clamp to 1 (On) automatically via constrainedNumberStorage.
export const oneStringIntervalAtom = atomWithStorage<number>(
  k("oneString.interval"),
  0,
  constrainedNumberStorage({ min: 0, max: 1, integer: true }),
  GET_ON_INIT,
);

// two-strings sub-controls
export const twoStringsPairAtom = atomWithStorage(
  k("twoStrings.pair"),
  0,
  constrainedNumberStorage({ min: 0, max: 4, integer: true }),
  GET_ON_INIT,
);

// two-strings interval sub-control (0 = Off, 1 = 3rds, 2 = 4ths, 3 = 6ths)
// max stays 3; R05 swaps 5ths (old index 3) for 6ths (new index 3).
// If a user persisted "5ths" (was index 3) it maps to "6ths" now — acceptable migration.
export const twoStringsIntervalAtom = atomWithStorage(
  k("twoStrings.interval"),
  0,
  constrainedNumberStorage({ min: 0, max: 3, integer: true }),
  GET_ON_INIT,
);

// Adjacent pair table: used when interval ∈ {Off, 3rds, 4ths}
const ADJACENT_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
];

// Skip-one pair table: used when interval = 6ths
const SKIP_ONE_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 2], [1, 3], [2, 4], [3, 5],
];

/**
 * Derived atom that resolves the active pair index + interval to an actual
 * string-index tuple [stringA, stringB] based on the topology rule (Option X):
 *
 *   - interval ∈ {Off=0, 3rds=1, 4ths=2} → adjacent pairs table (5 entries)
 *   - interval = 6ths=3                   → skip-one pairs table (4 entries)
 *
 * twoStringsPairAtom keeps range 0-4 (5-button UI). The derived atom clamps
 * to the active table's max index so pair=4 + interval=6ths → skip-one pair[3].
 */
export const twoStringsActivePairTupleAtom = atom((get): readonly [number, number] => {
  const interval = get(twoStringsIntervalAtom);
  const pair = get(twoStringsPairAtom);
  const isSixths = interval === 3;
  const table = isSixths ? SKIP_ONE_PAIRS : ADJACENT_PAIRS;
  const clamped = Math.min(pair, table.length - 1);
  return table[clamped]!;
});
