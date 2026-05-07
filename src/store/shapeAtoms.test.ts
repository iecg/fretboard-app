// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { shapeDataAtom } from "./shapeAtoms";
import {
  fingeringPatternAtom,
  twoStringsPairAtom,
  twoStringsIntervalAtom,
} from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { makeAtomStore } from "../test-utils/renderWithAtoms";

// ---------------------------------------------------------------------------
// shapeDataAtom — two-strings intervalPairs branch (UAT-8 regression guard)
// ---------------------------------------------------------------------------

describe("shapeDataAtom — two-strings intervalPairs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("emits non-empty intervalPairs when two-strings pattern is active and interval > 0", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, 0],
      [twoStringsIntervalAtom, 1], // 1 = 3rds (4 semitones)
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const data = store.get(shapeDataAtom);
    expect(data.intervalPairs.length).toBeGreaterThan(0);
    // Each pair should have "string-fret" keys
    for (const pair of data.intervalPairs) {
      expect(pair.a).toMatch(/^\d+-\d+$/);
      expect(pair.b).toMatch(/^\d+-\d+$/);
    }
  });

  it("emits empty intervalPairs when interval is 0 (Off)", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, 0],
      [twoStringsIntervalAtom, 0], // 0 = Off
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const data = store.get(shapeDataAtom);
    expect(data.intervalPairs).toHaveLength(0);
  });

  it("emits empty intervalPairs when fingeringPattern is not two-strings", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "none"],
      [twoStringsIntervalAtom, 2],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const data = store.get(shapeDataAtom);
    expect(data.intervalPairs).toHaveLength(0);
  });

  it("pair members reference coordinates on the correct string pair", () => {
    const pairIndex = 2; // strings 2 and 3
    const store = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, pairIndex],
      [twoStringsIntervalAtom, 3], // 3 = 5ths (7 semitones)
      [rootNoteAtom, "G"],
      [scaleNameAtom, "Major"],
    ]);
    const data = store.get(shapeDataAtom);
    expect(data.intervalPairs.length).toBeGreaterThan(0);
    for (const pair of data.intervalPairs) {
      const aStr = parseInt(pair.a.split("-")[0], 10);
      const bStr = parseInt(pair.b.split("-")[0], 10);
      expect(aStr).toBe(pairIndex);
      expect(bStr).toBe(pairIndex + 1);
    }
  });
});
