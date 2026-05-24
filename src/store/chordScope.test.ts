import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import {
  chordScopeToPositionAtom,
  activePositionAtom,
} from "./chordScope";
import { fingeringPatternAtom, cagedShapesAtom, npsPositionAtom } from "./fingeringAtoms";

describe("chordScope atoms", () => {
  let store: ReturnType<typeof createStore>;
  beforeEach(() => {
    store = createStore();
  });

  it("chordScopeToPositionAtom defaults to false", () => {
    expect(store.get(chordScopeToPositionAtom)).toBe(false);
  });

  it("activePositionAtom is false when fingering is 'none'", () => {
    store.set(fingeringPatternAtom, "none");
    expect(store.get(activePositionAtom)).toBe(false);
  });

  it("activePositionAtom is true when a single CAGED shape is selected", () => {
    store.set(fingeringPatternAtom, "caged");
    store.set(cagedShapesAtom, new Set(["C"]));
    expect(store.get(activePositionAtom)).toBe(true);
  });

  it("activePositionAtom is true when multiple CAGED shapes are selected", () => {
    store.set(fingeringPatternAtom, "caged");
    store.set(cagedShapesAtom, new Set(["C", "A"]));
    expect(store.get(activePositionAtom)).toBe(true);
  });

  it("activePositionAtom is true when fingering is 3nps and npsPosition > 0", () => {
    store.set(fingeringPatternAtom, "3nps");
    store.set(npsPositionAtom, 1);
    expect(store.get(activePositionAtom)).toBe(true);
  });

  it("activePositionAtom is false for one-string / two-strings", () => {
    store.set(fingeringPatternAtom, "one-string");
    expect(store.get(activePositionAtom)).toBe(false);
    store.set(fingeringPatternAtom, "two-strings");
    expect(store.get(activePositionAtom)).toBe(false);
  });
});
