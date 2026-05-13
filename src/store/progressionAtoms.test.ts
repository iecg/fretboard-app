// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore, type Atom } from "jotai";
import {
  activeProgressionStepIndexAtom,
  activeResolvedProgressionStepAtom,
  addProgressionStepAtom,
  advanceProgressionPlaybackAtom,
  loadProgressionPresetAtom,
  moveProgressionStepAtom,
  progressionEnabledAtom,
  progressionLoopEnabledAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  progressionStepDurationMsAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  removeProgressionStepAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
  updateProgressionStepDegreeAtom,
  updateProgressionStepDurationAtom,
  updateProgressionStepQualityAtom,
} from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";

describe("progressionAtoms", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("resolves the active step from the current key and scale", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(progressionEnabledAtom, true);
    store.set(progressionStepsAtom, [
      { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ]);

    expect(store.get(activeResolvedProgressionStepAtom)).toMatchObject({
      root: "G",
      quality: "Major Triad",
      unavailable: false,
    });
  });

  it("loads a preset and remaps labels to the active scale", () => {
    const store = createStore();
    store.set(scaleNameAtom, "Natural Minor");

    store.set(loadProgressionPresetAtom, "one-five-six-four");

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual([
      "i",
      "v",
      "VI",
      "iv",
    ]);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("updates the active step degree, duration, and quality", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ]);

    store.set(updateProgressionStepDegreeAtom, { id: "one", degree: "V" });
    store.set(updateProgressionStepDurationAtom, { id: "one", duration: { value: 2, unit: "bar" } });
    store.set(updateProgressionStepQualityAtom, { id: "one", qualityOverride: "Dominant 7th" });

    expect(store.get(progressionStepsAtom)[0]).toEqual({
      id: "one",
      degree: "V",
      duration: { value: 2, unit: "bar" },
      qualityOverride: "Dominant 7th",
    });
  });

  it("adds, removes, and moves steps while keeping the cursor in range", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 1);

    store.set(addProgressionStepAtom);
    expect(store.get(progressionStepsAtom)).toHaveLength(3);

    const added = store.get(progressionStepsAtom)[2]!;
    store.set(moveProgressionStepAtom, { id: added.id, direction: -1 });
    expect(store.get(progressionStepsAtom)[1]?.id).toBe(added.id);

    store.set(removeProgressionStepAtom, "two");
    expect(store.get(progressionStepsAtom).map((step) => step.id)).not.toContain("two");
    expect(store.get(activeProgressionStepIndexAtom)).toBeLessThan(store.get(progressionStepsAtom).length);
  });

  it("converts active step duration through tempo", () => {
    const store = createStore();
    store.set(progressionTempoBpmAtom, 120);
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 2, unit: "bar" }, qualityOverride: null },
    ]);

    expect(store.get(progressionStepDurationMsAtom)).toBe(4000);
  });

  it("does not start playback when there are no resolvable steps", () => {
    const store = createStore();
    store.set(progressionEnabledAtom, true);
    store.set(progressionStepsAtom, []);

    store.set(setProgressionPlayingAtom, true);

    expect(store.get(progressionPlayingAtom)).toBe(false);
    expect(store.get(progressionPlaybackBlockedReasonAtom)).toBe("Add or load progression steps to start playback.");
  });

  it("advances through resolvable steps and stops at the end when loop is off", () => {
    const store = createStore();
    store.set(progressionEnabledAtom, true);
    store.set(progressionLoopEnabledAtom, false);
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "two", degree: "not-a-degree", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "three", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ]);
    store.set(setProgressionPlayingAtom, true);

    store.set(advanceProgressionPlaybackAtom);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
    expect(store.get(progressionPlayingAtom)).toBe(true);

    store.set(advanceProgressionPlaybackAtom);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
    expect(store.get(progressionPlayingAtom)).toBe(false);
  });
});

// Trigger onMount for an atom so atomWithStorage reads from localStorage.
// Returns cleanup (unsubscribe) function.
function mount<T>(store: ReturnType<typeof createStore>, atom: Atom<T>): () => void {
  return store.sub(atom, () => {});
}

describe("progression storage hydration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hydrates a step with a legacy duration string into the new object shape", () => {
    const key = "fretflow:progressionSteps";
    const legacy = [
      { id: "x", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "y", degree: "V", duration: "2-beats", qualityOverride: null },
    ];
    localStorage.setItem(key, JSON.stringify(legacy));

    const store = createStore();
    const unsub = mount(store, progressionStepsAtom);
    const steps = store.get(progressionStepsAtom);
    unsub();

    expect(steps).toHaveLength(2);
    expect(steps[0].duration).toEqual({ value: 1, unit: "bar" });
    expect(steps[1].duration).toEqual({ value: 2, unit: "beat" });
  });
});
