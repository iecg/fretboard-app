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
// shapeDataAtom — two-strings intervalPairs branch (UAT-8 + UAT-10 regression guard)
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

  it("pair members reference coordinates on the correct string pair (4ths, adjacent)", () => {
    const pairIndex = 2; // strings 2 and 3 (adjacent)
    const store = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, pairIndex],
      [twoStringsIntervalAtom, 2], // 2 = 4ths (SD distance 3, adjacent pairs)
      [rootNoteAtom, "G"],
      [scaleNameAtom, "Major"],
    ]);
    const data = store.get(shapeDataAtom);
    expect(data.intervalPairs.length).toBeGreaterThan(0);
    for (const pair of data.intervalPairs) {
      const aStr = parseInt(pair.a.split("-")[0], 10);
      const bStr = parseInt(pair.b.split("-")[0], 10);
      expect(aStr).toBe(2);
      expect(bStr).toBe(3);
    }
  });

  it("interval=6ths + pair=0: notes are on skip-one strings 0+2 (Option X)", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, 0],
      [twoStringsIntervalAtom, 3], // 3 = 6ths (skip-one topology)
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const data = store.get(shapeDataAtom);
    // With skip-one pair[0] = [0,2], highlightNotes should be on strings 0 and 2
    const strings = new Set(data.highlightNotes.map((c) => parseInt(c.split("-")[0], 10)));
    expect(strings.has(0)).toBe(true);
    expect(strings.has(2)).toBe(true);
    expect(strings.has(1)).toBe(false);
  });

  it("interval=6ths + pair=4: clamped to skip-one[3] = strings 3+5 (no throw)", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, 4], // out-of-range for skip-one, clamped to 3
      [twoStringsIntervalAtom, 3], // 3 = 6ths
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    // Must not throw; should produce notes on strings 3+5
    expect(() => store.get(shapeDataAtom)).not.toThrow();
    const data = store.get(shapeDataAtom);
    const strings = new Set(data.highlightNotes.map((c) => parseInt(c.split("-")[0], 10)));
    expect(strings.has(3)).toBe(true);
    expect(strings.has(5)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // UAT-10 regression guard: visibility decoupled from interval setting
  // ---------------------------------------------------------------------------

  it("with interval > 0, highlightNotes contains all pair scale notes (visibility unfiltered)", () => {
    // Build store with interval = Off to get the full unfiltered note set
    const storeOff = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, 0],
      [twoStringsIntervalAtom, 0], // Off
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    // Build store with interval > 0
    const storeOn = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, 0],
      [twoStringsIntervalAtom, 1], // 3rds
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);

    const offData = storeOff.get(shapeDataAtom);
    const onData = storeOn.get(shapeDataAtom);

    // highlightNotes should be identical whether interval is On or Off
    expect(new Set(onData.highlightNotes)).toEqual(new Set(offData.highlightNotes));
    // intervalPairs should only be non-empty when interval > 0
    expect(offData.intervalPairs).toHaveLength(0);
    expect(onData.intervalPairs.length).toBeGreaterThan(0);
  });

  it("intervalPairs is a strict subset of highlightNotes when interval > 0", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "two-strings"],
      [twoStringsPairAtom, 0],
      [twoStringsIntervalAtom, 2], // 4ths
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const data = store.get(shapeDataAtom);
    const highlightSet = new Set(data.highlightNotes);
    // Every pair member coord must be in highlightNotes
    for (const pair of data.intervalPairs) {
      expect(highlightSet.has(pair.a)).toBe(true);
      expect(highlightSet.has(pair.b)).toBe(true);
    }
  });
});
