import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { getDegreeSequence } from "../core/degrees";
import type { DegreeId } from "../core/degrees";
import { k, createStorage, GET_ON_INIT } from "../utils/storage";
import { baseScaleNameAtom } from "./scaleAtoms";
import { chordDegreeAtom, chordOverlayModeAtom } from "./chordOverlayAtoms";

// ---------------------------------------------------------------------------
// Storage adapter — unbounded integer index; clamping handled at action time
// ---------------------------------------------------------------------------

const progressionIndexStorage = createStorage<number>({
  serialize: (v) => String(v),
  deserialize: (v) => {
    const num = Number(v);
    return Number.isNaN(num) || !Number.isInteger(num)
      ? (undefined as unknown as number)
      : num;
  },
  validate: (num) =>
    typeof num === "number" && Number.isInteger(num) && num >= 0,
});

// ---------------------------------------------------------------------------
// progressionIndexAtom — persisted, integer >= 0, no max constraint
// ---------------------------------------------------------------------------

/** Persisted index into the active scale's degree sequence. */
export const progressionIndexAtom = atomWithStorage<number>(
  k("progressionIndex"),
  0,
  progressionIndexStorage,
  GET_ON_INIT,
);

// ---------------------------------------------------------------------------
// clampedProgressionIndexAtom — derived, read-only, clamps to scale length
// ---------------------------------------------------------------------------

/**
 * Reads progressionIndexAtom and clamps it to the degree count of the current
 * scale. Safe to use in UI; use progressionIndexAtom directly for writes.
 */
export const clampedProgressionIndexAtom = atom((get) => {
  const index = get(progressionIndexAtom);
  const scaleName = get(baseScaleNameAtom);
  const sequence = getDegreeSequence(scaleName);
  if (sequence.length === 0) return 0;
  return Math.min(index, sequence.length - 1);
});

// ---------------------------------------------------------------------------
// Action atoms — advance / regress
// ---------------------------------------------------------------------------

/**
 * Advances the progression index by 1 (wraps), then writes the corresponding
 * DegreeId to chordDegreeAtom so the chord overlay updates immediately.
 */
export const advanceProgression = atom(null, (get, set) => {
  const scaleName = get(baseScaleNameAtom);
  const sequence = getDegreeSequence(scaleName);
  if (sequence.length === 0) return;
  const clamped = get(clampedProgressionIndexAtom);
  const next = (clamped + 1) % sequence.length;
  set(progressionIndexAtom, next);
  if (get(chordOverlayModeAtom) !== "degree") {
    set(chordOverlayModeAtom, "degree");
  }
  set(chordDegreeAtom, sequence[next] as DegreeId);
});

/**
 * Regresses the progression index by 1 (wraps), then writes the corresponding
 * DegreeId to chordDegreeAtom so the chord overlay updates immediately.
 */
export const regressProgression = atom(null, (get, set) => {
  const scaleName = get(baseScaleNameAtom);
  const sequence = getDegreeSequence(scaleName);
  if (sequence.length === 0) return;
  const clamped = get(clampedProgressionIndexAtom);
  const prev = (clamped - 1 + sequence.length) % sequence.length;
  set(progressionIndexAtom, prev);
  if (get(chordOverlayModeAtom) !== "degree") {
    set(chordOverlayModeAtom, "degree");
  }
  set(chordDegreeAtom, sequence[prev] as DegreeId);
});
