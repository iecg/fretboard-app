// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore, type Atom } from "jotai";
import { k } from "../test-utils/storage";
import {
  progressionIndexAtom,
  clampedProgressionIndexAtom,
  advanceProgression,
  regressProgression,
} from "./progressionAtoms";
import { chordDegreeAtom, chordOverlayModeAtom } from "./chordOverlayAtoms";
import { baseScaleNameAtom } from "./scaleAtoms";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import { getDegreeSequence, type DegreeId } from "../core/degrees";

// Trigger onMount for an atom so atomWithStorage reads from localStorage.
// Returns cleanup (unsubscribe) function.
function mount<T>(
  store: ReturnType<typeof createStore>,
  atom: Atom<T>,
): () => void {
  return store.sub(atom, () => {});
}

// ---------------------------------------------------------------------------
// Group A — default state + persistence
// ---------------------------------------------------------------------------

describe("progressionAtoms — default state + persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("progressionIndexAtom defaults to 0", () => {
    const store = makeAtomStore();
    expect(store.get(progressionIndexAtom)).toBe(0);
  });

  it("progressionIndexAtom persists to localStorage under k('progressionIndex')", () => {
    const store = makeAtomStore();
    const unsub = mount(store, progressionIndexAtom);
    store.set(progressionIndexAtom, 3);
    expect(localStorage.getItem(k("progressionIndex"))).toBe("3");
    unsub();
  });

  it("progressionIndexAtom rehydrates from localStorage on fresh store", () => {
    localStorage.setItem(k("progressionIndex"), "2");
    const store = createStore();
    const unsub = mount(store, progressionIndexAtom);
    expect(store.get(progressionIndexAtom)).toBe(2);
    unsub();
  });
});

// ---------------------------------------------------------------------------
// Group B — advanceProgression
// ---------------------------------------------------------------------------

describe("progressionAtoms — advanceProgression", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("advances index from 0 to 1 in Major scale", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 0],
    ]);
    store.set(advanceProgression);
    expect(store.get(progressionIndexAtom)).toBe(1);
  });

  it("writes correct DegreeId to chordDegreeAtom when advancing (I → ii in C Major)", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 0],
    ]);
    store.set(advanceProgression);
    // Major scale degrees sorted by semitone: I(0), ii(2), iii(4), IV(5), V(7), vi(9), vii°(11)
    // index 0→1 = "ii"
    expect(store.get(chordDegreeAtom)).toBe("ii");
  });

  it("wraps from last index (6) back to 0 in Major scale (7 degrees)", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 6],
    ]);
    store.set(advanceProgression);
    expect(store.get(progressionIndexAtom)).toBe(0);
  });

  it("writes 'I' to chordDegreeAtom when wrapping from last to first in Major", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 6],
    ]);
    store.set(advanceProgression);
    expect(store.get(chordDegreeAtom)).toBe("I");
  });

  it("forces overlay mode to 'degree' so manual overrides do not mask the progression", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 0],
      [chordOverlayModeAtom, "manual"],
    ]);
    store.set(advanceProgression);
    expect(store.get(chordOverlayModeAtom)).toBe("degree");
    const expected = getDegreeSequence("Major")[1] as DegreeId;
    expect(store.get(chordDegreeAtom)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Group C — regressProgression
// ---------------------------------------------------------------------------

describe("progressionAtoms — regressProgression", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("decrements index from 2 to 1 in Major scale", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 2],
    ]);
    store.set(regressProgression);
    expect(store.get(progressionIndexAtom)).toBe(1);
  });

  it("wraps from index 0 to last (6) in Major scale (7 degrees)", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 0],
    ]);
    store.set(regressProgression);
    expect(store.get(progressionIndexAtom)).toBe(6);
  });

  it("writes 'vii°' to chordDegreeAtom when wrapping from first to last in Major", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 0],
    ]);
    store.set(regressProgression);
    expect(store.get(chordDegreeAtom)).toBe("vii°");
  });
});

// ---------------------------------------------------------------------------
// Group D — clampedProgressionIndexAtom
// ---------------------------------------------------------------------------

describe("progressionAtoms — clampedProgressionIndexAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the raw index when within bounds (Major scale, 7 degrees)", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 3],
    ]);
    expect(store.get(clampedProgressionIndexAtom)).toBe(3);
  });

  it("clamps index 99 to sequence.length - 1 for Major scale (max = 6)", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 99],
    ]);
    expect(store.get(clampedProgressionIndexAtom)).toBe(6);
  });

  it("scale change safety: out-of-range index on Major Pentatonic clamps to last degree", () => {
    const store = makeAtomStore([
      [baseScaleNameAtom, "Major"],
      [progressionIndexAtom, 99],
    ]);
    store.set(baseScaleNameAtom, "Major Pentatonic");
    const sequence = getDegreeSequence("Major Pentatonic");
    const clamped = store.get(clampedProgressionIndexAtom);
    expect(clamped).toBe(sequence.length - 1);
  });
});
