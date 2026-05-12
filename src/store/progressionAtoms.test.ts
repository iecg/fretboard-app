// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore, type Atom } from "jotai";
import {
  activeProgressionStepAtom,
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
  progressionStepDeadlineAtom,
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
import { k } from "../test-utils/storage";

function mount<T>(store: ReturnType<typeof createStore>, atom: Atom<T>): () => void {
  return store.sub(atom, () => {});
}

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
      { id: "v", degree: "V", duration: "1-bar", qualityOverride: null },
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
    store.set(progressionEnabledAtom, true);
    store.set(progressionStepsAtom, [
      { id: "minor-one", degree: "i", duration: "1-bar", qualityOverride: null },
    ]);
    store.set(setProgressionPlayingAtom, true);
    expect(store.get(progressionPlayingAtom)).toBe(true);
    expect(store.get(progressionStepDeadlineAtom)).not.toBeNull();

    store.set(loadProgressionPresetAtom, "one-five-six-four");

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual([
      "i",
      "v",
      "VI",
      "iv",
    ]);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
    expect(store.get(progressionEnabledAtom)).toBe(true);
    expect(store.get(progressionPlayingAtom)).toBe(false);
    expect(store.get(progressionStepDeadlineAtom)).toBeNull();
  });

  it("updates the active step degree, duration, and quality", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
    ]);

    store.set(updateProgressionStepDegreeAtom, { id: "one", degree: "V" });
    store.set(updateProgressionStepDurationAtom, { id: "one", duration: "2-bars" });
    store.set(updateProgressionStepQualityAtom, { id: "one", qualityOverride: "Dominant 7th" });

    expect(store.get(progressionStepsAtom)[0]).toEqual({
      id: "one",
      degree: "V",
      duration: "2-bars",
      qualityOverride: "Dominant 7th",
    });
  });

  it("adds, removes, and moves steps while keeping the cursor in range", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
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

  it("preserves the active step identity when removing an earlier step", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
      { id: "three", degree: "vi", duration: "1-bar", qualityOverride: null },
      { id: "four", degree: "IV", duration: "1-bar", qualityOverride: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 2);

    store.set(removeProgressionStepAtom, "one");

    expect(store.get(activeProgressionStepAtom)?.id).toBe("three");
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });

  it("preserves the active step identity when moving a non-active step", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
      { id: "three", degree: "vi", duration: "1-bar", qualityOverride: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 2);

    store.set(moveProgressionStepAtom, { id: "one", direction: 1 });

    expect(store.get(activeProgressionStepAtom)?.id).toBe("three");
    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
  });

  it("preserves active step identity when moving a non-active step across it", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
      { id: "three", degree: "vi", duration: "1-bar", qualityOverride: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 1);

    store.set(moveProgressionStepAtom, { id: "one", direction: 1 });

    expect(store.get(progressionStepsAtom).map((step) => step.id)).toEqual([
      "two",
      "one",
      "three",
    ]);
    expect(store.get(activeProgressionStepAtom)?.id).toBe("two");
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("preserves active step identity and moves the active index with it", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
      { id: "three", degree: "vi", duration: "1-bar", qualityOverride: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 1);

    store.set(moveProgressionStepAtom, { id: "two", direction: 1 });

    expect(store.get(progressionStepsAtom).map((step) => step.id)).toEqual([
      "one",
      "three",
      "two",
    ]);
    expect(store.get(activeProgressionStepAtom)?.id).toBe("two");
    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
  });

  it("filters invalid stored progression steps and self-heals storage", () => {
    const storedSteps = [
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "missing-duration", degree: "V", qualityOverride: null },
      { id: "two", degree: "vi", duration: "2-bars", qualityOverride: "Minor 7th" },
    ];
    localStorage.setItem(k("progressionSteps"), JSON.stringify(storedSteps));

    const store = createStore();
    const unmount = mount(store, progressionStepsAtom);

    expect(store.get(progressionStepsAtom).map((step) => step.id)).toEqual(["one", "two"]);
    expect(JSON.parse(localStorage.getItem(k("progressionSteps")) ?? "[]")).toEqual([
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "two", degree: "vi", duration: "2-bars", qualityOverride: "Minor 7th" },
    ]);
    unmount();
  });

  it("normalizes non-array stored progression steps to defaults and self-heals storage", () => {
    localStorage.setItem(k("progressionSteps"), JSON.stringify({ id: "not-an-array" }));

    const store = createStore();
    const unmount = mount(store, progressionStepsAtom);

    expect(store.get(progressionStepsAtom).map((step) => step.id)).toEqual([
      "default-i",
      "default-v",
      "default-vi",
      "default-iv",
    ]);
    expect(JSON.parse(localStorage.getItem(k("progressionSteps")) ?? "[]")).toEqual(
      store.get(progressionStepsAtom),
    );
    unmount();
  });

  it("converts active step duration through tempo", () => {
    const store = createStore();
    store.set(progressionTempoBpmAtom, 120);
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: "2-bars", qualityOverride: null },
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
      { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
      { id: "two", degree: "not-a-degree", duration: "1-bar", qualityOverride: null },
      { id: "three", degree: "V", duration: "1-bar", qualityOverride: null },
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
