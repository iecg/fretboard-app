// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore, type Atom } from "jotai";
import {
  activeProgressionStepIndexAtom,
  activeResolvedProgressionStepAtom,
  addProgressionStepAtom,
  advanceProgressionPlaybackAtom,
  beatsPerBarAtom,
  currentProgressionBarAtom,
  currentProgressionPresetIdAtom,
  duplicateProgressionStepAtom,
  loadProgressionPresetAtom,
  moveProgressionStepAtom,
  progressionLoopEnabledAtom,
  progressionPlaybackBlockedReasonAtom,
  progressionPlayingAtom,
  progressionStepDurationMsAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  removeProgressionStepAtom,
  resetProgressionAtomsAtom,
  setProgressionActiveStepIndexAtom,
  setProgressionPlayingAtom,
  totalProgressionBarsAtom,
  updateProgressionStepCachedDegreeAtom,
  updateProgressionStepDegreeAtom,
  updateProgressionStepDurationAtom,
  updateProgressionStepQualityAtom,
  timeSignatureDenominatorAtom,
  updateProgressionStepRootAtom,
} from "./progressionAtoms";
import { DEFAULT_BEATS_PER_BAR } from "../progressions/progressionDomain";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";

describe("progressionAtoms", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("resolves the active step from the current key and scale", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(progressionStepsAtom, [
      { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);

    expect(store.get(activeResolvedProgressionStepAtom)).toMatchObject({
      root: "G",
      quality: "Major Triad",
      unavailable: false,
    });
  });

  it("loads a preset and remaps labels to the active scale", () => {
    const store = createStore();
    store.set(scaleNameAtom, "minor");

    store.set(loadProgressionPresetAtom, "one-five-six-four");

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual([
      "i",
      "v",
      "VI",
      "iv",
    ]);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
    expect(store.get(currentProgressionPresetIdAtom)).toBe("one-five-six-four");
  });

  it("updates the active step degree, duration, and quality", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);

    store.set(updateProgressionStepDegreeAtom, { id: "one", degree: "V" });
    store.set(updateProgressionStepDurationAtom, { id: "one", duration: { value: 2, unit: "bar" } });
    store.set(updateProgressionStepQualityAtom, { id: "one", qualityOverride: "Dominant 7th" });

    expect(store.get(progressionStepsAtom)[0]).toEqual({
      id: "one",
      degree: "V",
      duration: { value: 2, unit: "bar" },
      qualityOverride: "Dominant 7th",
      manualRoot: null,
    });
  });

  it("adds, removes, and moves steps while keeping the cursor in range", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
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
      { id: "one", degree: "I", duration: { value: 2, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);

    expect(store.get(progressionStepDurationMsAtom)).toBe(4000);
  });

  it("does not start playback when there are no resolvable steps", () => {
    const store = createStore();
    store.set(progressionStepsAtom, []);

    store.set(setProgressionPlayingAtom, true);

    expect(store.get(progressionPlayingAtom)).toBe(false);
    expect(store.get(progressionPlaybackBlockedReasonAtom)).toBe("Add or load progression steps to start playback.");
  });

  it("advances through resolvable steps and stops at the end when loop is off", () => {
    const store = createStore();
    store.set(progressionLoopEnabledAtom, false);
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "two", degree: "not-a-degree", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "three", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
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

describe("beatsPerBarAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 4", () => {
    const store = createStore();
    expect(store.get(beatsPerBarAtom)).toBe(4);
  });

  it("accepts 3, 4, 6, 8 and persists", () => {
    const store = createStore();
    const unsub = mount(store, beatsPerBarAtom);
    store.set(beatsPerBarAtom, 3);
    expect(store.get(beatsPerBarAtom)).toBe(3);
    store.set(beatsPerBarAtom, 6);
    expect(store.get(beatsPerBarAtom)).toBe(6);
    expect(localStorage.getItem("fretflow:progressionBeatsPerBar")).toBe("6");
    unsub();
  });
});

describe("beatsPerBarAtom storage validation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to the default when storage value is out-of-set", () => {
    localStorage.setItem("fretflow:progressionBeatsPerBar", "5");
    const store = createStore();
    const unsub = mount(store, beatsPerBarAtom);
    expect(store.get(beatsPerBarAtom)).toBe(DEFAULT_BEATS_PER_BAR);
    unsub();
    localStorage.removeItem("fretflow:progressionBeatsPerBar");
  });
});

describe("resetProgressionAtomsAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resets beatsPerBarAtom to its default", () => {
    const store = createStore();
    const unsub = mount(store, beatsPerBarAtom);
    store.set(beatsPerBarAtom, 6);
    expect(store.get(beatsPerBarAtom)).toBe(6);

    store.set(resetProgressionAtomsAtom);
    expect(store.get(beatsPerBarAtom)).toBe(DEFAULT_BEATS_PER_BAR);
    unsub();
  });
});

describe("updateProgressionStepDurationAtom", () => {
  it("writes the new object duration shape", () => {
    const store = createStore();
    const id = store.get(progressionStepsAtom)[0].id;
    store.set(updateProgressionStepDurationAtom, { id, duration: { value: 3, unit: "beat" } });
    const updated = store.get(progressionStepsAtom).find((s) => s.id === id);
    expect(updated?.duration).toEqual({ value: 3, unit: "beat" });
  });

  it("rejects out-of-range or non-integer values", () => {
    const store = createStore();
    const id = store.get(progressionStepsAtom)[0].id;
    const before = store.get(progressionStepsAtom).find((s) => s.id === id)?.duration;
    store.set(updateProgressionStepDurationAtom, { id, duration: { value: 0, unit: "bar" } });
    expect(store.get(progressionStepsAtom).find((s) => s.id === id)?.duration).toEqual(before);
    store.set(updateProgressionStepDurationAtom, { id, duration: { value: 17, unit: "bar" } });
    expect(store.get(progressionStepsAtom).find((s) => s.id === id)?.duration).toEqual(before);
  });
});

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

describe("derived progression atoms", () => {
  it("totalProgressionBarsAtom sums step bars", () => {
    const store = createStore();
    expect(store.get(totalProgressionBarsAtom)).toBe(4); // 4 default steps × 1 bar
  });

  it("currentProgressionBarAtom returns 1 when at the start", () => {
    const store = createStore();
    expect(store.get(currentProgressionBarAtom)).toBe(1);
  });

  it("currentProgressionBarAtom skips past previous chord bars", () => {
    const store = createStore();
    store.set(activeProgressionStepIndexAtom, 2);
    expect(store.get(currentProgressionBarAtom)).toBe(3); // bars 1, 2 elapsed
  });

  it("currentProgressionPresetIdAtom matches the I-V-vi-IV default", () => {
    const store = createStore();
    expect(store.get(currentProgressionPresetIdAtom)).toBe("one-five-six-four");
  });

  it("currentProgressionPresetIdAtom ignores presets unavailable for the active scale", () => {
    const store = createStore();
    store.set(scaleNameAtom, "minor blues");
    expect(store.get(currentProgressionPresetIdAtom)).toBe("custom");
  });

  it("currentProgressionPresetIdAtom returns 'custom' after any edit", () => {
    const store = createStore();
    const steps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, [...steps, { id: "new", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null }]);
    expect(store.get(currentProgressionPresetIdAtom)).toBe("custom");
  });

  describe("duplicateProgressionStepAtom", () => {
    it("inserts a copy of the source step directly after it and selects the copy", () => {
      const store = createStore();
      store.set(progressionStepsAtom, [
        { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        { id: "b", degree: "V", duration: { value: 2, unit: "beat" }, qualityOverride: "Dominant 7th", manualRoot: null },
      ]);

      store.set(duplicateProgressionStepAtom, "b");

      const steps = store.get(progressionStepsAtom);
      expect(steps).toHaveLength(3);
      expect(steps.map((s) => s.degree)).toEqual(["I", "V", "V"]);
      expect(steps[2].id).not.toBe("b");
      expect(steps[2].duration).toEqual({ value: 2, unit: "beat" });
      expect(steps[2].qualityOverride).toBe("Dominant 7th");
      expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
    });

    it("is a no-op when the step id is unknown", () => {
      const store = createStore();
      store.set(progressionStepsAtom, [
        { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);

      store.set(duplicateProgressionStepAtom, "missing");

      expect(store.get(progressionStepsAtom)).toHaveLength(1);
    });
  });

  describe("updateProgressionStepRootAtom", () => {
    it("sets manualRoot on the target step", () => {
      const store = createStore();
      const id = store.get(progressionStepsAtom)[0]!.id;
      store.set(updateProgressionStepRootAtom, { id, manualRoot: "F#" });
      expect(store.get(progressionStepsAtom)[0]!.manualRoot).toBe("F#");
    });

    it("clears manualRoot when given null", () => {
      const store = createStore();
      const id = store.get(progressionStepsAtom)[0]!.id;
      store.set(updateProgressionStepRootAtom, { id, manualRoot: "F#" });
      store.set(updateProgressionStepRootAtom, { id, manualRoot: null });
      expect(store.get(progressionStepsAtom)[0]!.manualRoot).toBeNull();
    });

    it("leaves other steps untouched", () => {
      const store = createStore();
      store.set(progressionStepsAtom, [
        { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
      store.set(updateProgressionStepRootAtom, { id: "a", manualRoot: "A#" });
      const steps = store.get(progressionStepsAtom);
      expect(steps[0]!.manualRoot).toBe("A#");
      expect(steps[1]!.manualRoot).toBeNull();
    });
  });

  describe("updateProgressionStepCachedDegreeAtom", () => {
    it("updates the degree on the target step", () => {
      const store = createStore();
      const id = store.get(progressionStepsAtom)[0]!.id;
      store.set(updateProgressionStepCachedDegreeAtom, { id, degree: "IV" });
      expect(store.get(progressionStepsAtom)[0]!.degree).toBe("IV");
    });

    it("does not clear qualityOverride", () => {
      const store = createStore();
      store.set(progressionStepsAtom, [
        { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th", manualRoot: null },
      ]);
      store.set(updateProgressionStepCachedDegreeAtom, { id: "a", degree: "V" });
      expect(store.get(progressionStepsAtom)[0]).toMatchObject({
        degree: "V",
        qualityOverride: "Dominant 7th",
      });
    });
  });

  describe("rootNoteAtom change reaction (Phase 2.2)", () => {
    it("transposes manualRoot on scale-root change", () => {
      const store = createStore();
      const id = store.get(progressionStepsAtom)[0]!.id;
      store.set(rootNoteAtom, "A");
      store.set(updateProgressionStepRootAtom, { id, manualRoot: "F#" });
      store.set(rootNoteAtom, "C"); // up minor third
      expect(
        store.get(progressionStepsAtom).find((s) => s.id === id)?.manualRoot,
      ).toBe("A");
    });

    it("does not touch steps with null manualRoot on root change", () => {
      const store = createStore();
      store.set(rootNoteAtom, "A");
      const before = store.get(progressionStepsAtom)[0]!;
      store.set(rootNoteAtom, "C");
      const after = store.get(progressionStepsAtom).find((s) => s.id === before.id)!;
      expect(after.manualRoot).toBeNull();
      expect(after.degree).toBe(before.degree); // degree-keyed step unaffected
    });

    it("does NOT transpose manualRoot on scale-name change (only root change)", () => {
      const store = createStore();
      store.set(rootNoteAtom, "C");
      store.set(scaleNameAtom, "major");
      const id = store.get(progressionStepsAtom)[0]!.id;
      store.set(updateProgressionStepRootAtom, { id, manualRoot: "F#" });
      store.set(scaleNameAtom, "minor");
      expect(
        store.get(progressionStepsAtom).find((s) => s.id === id)?.manualRoot,
      ).toBe("F#");
    });
  });
});

describe("timeSignatureDenominatorAtom", () => {
  it("defaults to 4 (quarter-note beat)", () => {
    const store = createStore();
    expect(store.get(timeSignatureDenominatorAtom)).toBe(4);
  });

  it("accepts members of the valid denominator set", () => {
    const store = createStore();
    for (const d of [1, 2, 4, 8, 16] as const) {
      store.set(timeSignatureDenominatorAtom, d);
      expect(store.get(timeSignatureDenominatorAtom)).toBe(d);
    }
  });
});

describe("addProgressionStepAtom — v2.0 smart default", () => {
  it("seeds new step's qualityOverride with diatonic quality (not null)", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(progressionStepsAtom, []);
    store.set(addProgressionStepAtom);
    const steps = store.get(progressionStepsAtom);
    expect(steps).toHaveLength(1);
    expect(steps[0].qualityOverride).toBe("Major Triad");
  });

  it("uses the next ascending in-key degree for subsequent steps", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(progressionStepsAtom, [
      {
        id: "1",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: "Major Triad",
        manualRoot: null,
      },
    ]);
    store.set(addProgressionStepAtom);
    const steps = store.get(progressionStepsAtom);
    expect(steps).toHaveLength(2);
    expect(steps[1].degree).toBe("ii");
    expect(steps[1].qualityOverride).toBe("Minor Triad");
  });
});

describe("updateProgressionStepDegreeAtom — v2.0 independence", () => {
  it("does NOT reset qualityOverride when the degree changes", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(progressionStepsAtom, [
      {
        id: "1",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: "Major 7",
        manualRoot: null,
      },
    ]);
    store.set(updateProgressionStepDegreeAtom, { id: "1", degree: "ii" });
    const steps = store.get(progressionStepsAtom);
    expect(steps[0].degree).toBe("ii");
    expect(steps[0].qualityOverride).toBe("Major 7");
  });
});
