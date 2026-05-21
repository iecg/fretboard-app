import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
  activeChordRootAtom,
  activeChordQualityAtom,
  activeChordCachedDegreeAtom,
  activeChordIsManualAtom,
  updateActiveChordAtom,
} from "./songStateAtoms";
import { progressionStepsAtom } from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";

describe("songStateAtoms read", () => {
  it("activeChordRoot reads from the active step's resolved root by default", () => {
    const store = createStore();
    store.set(rootNoteAtom, "A");
    // scaleNameAtom defaults to "Major"; default progression first step is I → root "A"
    expect(store.get(activeChordRootAtom)).toBe("A");
  });

  it("activeChordIsManual is false for a default step", () => {
    const store = createStore();
    expect(store.get(activeChordIsManualAtom)).toBe(false);
  });

  it("activeChordCachedDegree reflects the step's degree", () => {
    const store = createStore();
    const expectedDegree = store.get(progressionStepsAtom)[0].degree;
    expect(store.get(activeChordCachedDegreeAtom)).toBe(expectedDegree);
  });
});

describe("updateActiveChordAtom write", () => {
  it("setting root makes the step manual and flips activeChordIsManual to true", () => {
    const store = createStore();
    store.set(rootNoteAtom, "A");
    store.set(scaleNameAtom, "Minor");
    store.set(updateActiveChordAtom, { root: "F#" });
    expect(store.get(activeChordIsManualAtom)).toBe(true);
    expect(store.get(activeChordRootAtom)).toBe("F#");
  });

  it("setting root=null clears manualRoot and reverts to diatonic", () => {
    const store = createStore();
    store.set(rootNoteAtom, "A");
    store.set(scaleNameAtom, "Minor");
    store.set(updateActiveChordAtom, { root: "F#" });
    store.set(updateActiveChordAtom, { root: null });
    expect(store.get(activeChordIsManualAtom)).toBe(false);
  });

  it("setting quality writes qualityOverride without altering manualRoot", () => {
    const store = createStore();
    store.set(updateActiveChordAtom, { quality: "Major Triad" });
    expect(store.get(activeChordQualityAtom)).toBe("Major Triad");
    expect(store.get(activeChordIsManualAtom)).toBe(false);
  });

  it("setting degree updates cachedDegree and does NOT clear qualityOverride", () => {
    const store = createStore();
    store.set(updateActiveChordAtom, { quality: "Major Triad" });
    store.set(updateActiveChordAtom, { degree: "IV" });
    expect(store.get(activeChordCachedDegreeAtom)).toBe("IV");
    expect(store.get(activeChordQualityAtom)).toBe("Major Triad");
  });

  it("combined patch applies all fields in one call", () => {
    const store = createStore();
    store.set(updateActiveChordAtom, { root: "G", quality: "Minor Triad" });
    expect(store.get(activeChordRootAtom)).toBe("G");
    expect(store.get(activeChordQualityAtom)).toBe("Minor Triad");
    expect(store.get(activeChordIsManualAtom)).toBe(true);
  });
});

