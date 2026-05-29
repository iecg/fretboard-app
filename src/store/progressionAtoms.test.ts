// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore, type Atom } from "jotai";
import {
  activeProgressionStepIndexAtom,
  activeResolvedProgressionStepAtom,
  addProgressionStepAtom,
  advanceProgressionPlaybackAtom, previousProgressionStepAtom,
  beatsPerBarAtom,
  currentProgressionBarAtom,
  currentProgressionPresetIdAtom,
  CUSTOM_PRESET_ID,
  displayedProgressionStepIndexAtom,
  displayedStepIndexPrimitiveAtom,
  duplicateProgressionStepAtom,
  loadProgressionPresetAtom,
  loadProgressionSuggestionAtom,
  loadedPresetIdAtom,
  resolvedProgressionStepsAtom,
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
  stopProgressionPlaybackAtom,
  totalProgressionBarsAtom,
  updateProgressionStepCachedDegreeAtom,
  updateProgressionStepDegreeAtom,
  updateProgressionStepDurationAtom,
  updateProgressionStepQualityAtom,
  timeSignatureDenominatorAtom,
  updateProgressionStepRootAtom,
  progressionPlaybackLoadingAtom,
} from "./progressionAtoms";
import { DEFAULT_BEATS_PER_BAR } from "../progressions/progressionDomain";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { generateCommonProgressions } from "../progressions/progressionGeneration";
import { makeAtomStore } from "../test-utils/renderWithAtoms";

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
      quality: "M",
      unavailable: false,
    });
  });

  it("loads a preset's home scale and degrees verbatim", () => {
    const store = createStore();
    store.set(scaleNameAtom, "minor");

    store.set(loadProgressionPresetAtom, "one-five-six-four");

    // Loading sets the preset's home scale and loads its degrees verbatim —
    // no ordinal remap into the previously active scale.
    expect(store.get(scaleNameAtom)).toBe("major");
    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual([
      "I",
      "V",
      "vi",
      "IV",
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
    store.set(updateProgressionStepQualityAtom, { id: "one", qualityOverride: "7" });

    expect(store.get(progressionStepsAtom)[0]).toEqual({
      id: "one",
      degree: "V",
      duration: { value: 2, unit: "bar" },
      qualityOverride: "7",
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

  it("does not wrap to the first step when advancing from the last step while stopped", () => {
    const store = createStore();
    store.set(progressionLoopEnabledAtom, true);
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 1);

    store.set(advanceProgressionPlaybackAtom);

    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
    expect(store.get(progressionPlayingAtom)).toBe(false);
  });

  it("does not wrap to the last step when moving backward from the first step while stopped", () => {
    const store = createStore();
    store.set(progressionLoopEnabledAtom, true);
    store.set(progressionStepsAtom, [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 0);

    store.set(previousProgressionStepAtom);

    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
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
    const key = "fretflow:progressionSteps.v2";
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

  it("currentProgressionPresetIdAtom returns 'custom' with no loaded id", () => {
    const store = createStore();
    store.set(loadedPresetIdAtom, null);
    const steps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, [...steps, { id: "new", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null }]);
    expect(store.get(currentProgressionPresetIdAtom)).toBe("custom");
  });

  describe("duplicateProgressionStepAtom", () => {
    it("inserts a copy of the source step directly after it and selects the copy", () => {
      const store = createStore();
      store.set(progressionStepsAtom, [
        { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        { id: "b", degree: "V", duration: { value: 2, unit: "beat" }, qualityOverride: "7", manualRoot: null },
      ]);

      store.set(duplicateProgressionStepAtom, "b");

      const steps = store.get(progressionStepsAtom);
      expect(steps).toHaveLength(3);
      expect(steps.map((s) => s.degree)).toEqual(["I", "V", "V"]);
      expect(steps[2].id).not.toBe("b");
      expect(steps[2].duration).toEqual({ value: 2, unit: "beat" });
      expect(steps[2].qualityOverride).toBe("7");
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
        { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "7", manualRoot: null },
      ]);
      store.set(updateProgressionStepCachedDegreeAtom, { id: "a", degree: "V" });
      expect(store.get(progressionStepsAtom)[0]).toMatchObject({
        degree: "V",
        qualityOverride: "7",
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
    expect(steps[0].qualityOverride).toBe("M");
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
        qualityOverride: "M",
        manualRoot: null,
      },
    ]);
    store.set(addProgressionStepAtom);
    const steps = store.get(progressionStepsAtom);
    expect(steps).toHaveLength(2);
    expect(steps[1].degree).toBe("ii");
    expect(steps[1].qualityOverride).toBe("m");
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

describe("progressionPlaybackLoadingAtom", () => {
  it("defaults to false", () => {
    const store = createStore();
    expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
  });

  it("is a writable boolean", () => {
    const store = createStore();
    store.set(progressionPlaybackLoadingAtom, true);
    expect(store.get(progressionPlaybackLoadingAtom)).toBe(true);
    store.set(progressionPlaybackLoadingAtom, false);
    expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
  });
});

describe("stopProgressionPlaybackAtom", () => {
  it("sets playing=false and activeIndex=0 atomically", () => {
    const store = createStore();
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 3);

    store.set(stopProgressionPlaybackAtom);

    expect(store.get(progressionPlayingAtom)).toBe(false);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("is idempotent when already stopped at index 0", () => {
    const store = createStore();
    store.set(stopProgressionPlaybackAtom);
    expect(store.get(progressionPlayingAtom)).toBe(false);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("stopProgressionPlaybackAtom resets active step index to the first resolvable step rather than unconditionally to 0", () => {
    const store = makeAtomStore([
      [scaleNameAtom, "major"],
      [rootNoteAtom, "C"],
      [progressionStepsAtom, [
        { id: "1", degree: "#IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null }, // Unavailable step
        { id: "2", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]],
      [activeProgressionStepIndexAtom, 1],
    ]);

    store.set(stopProgressionPlaybackAtom);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1); // Should snap to first resolvable (step index 1)
  });
});

describe("displayedProgressionStepIndexAtom", () => {
  it("returns logical index when not playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 1);
    expect(store.get(displayedProgressionStepIndexAtom)).toBe(1);
  });

  it("returns RAF-written primitive when playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(setProgressionPlayingAtom, true);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    expect(store.get(displayedProgressionStepIndexAtom)).toBe(1);
  });

  it("ignores stale primitive after playback stops", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(displayedStepIndexPrimitiveAtom, 1);
    expect(store.get(displayedProgressionStepIndexAtom)).toBe(0);
  });
});

describe("progression loading — scale coupling", () => {
  it("loading a minor preset sets minor scale, keeps root, resolves minor chords", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadProgressionPresetAtom, "minor-i-iv-v");
    expect(store.get(scaleNameAtom)).toBe("minor");
    expect(store.get(rootNoteAtom)).toBe("C");
    const resolved = store.get(resolvedProgressionStepsAtom);
    expect(resolved.map((s) => s.degree)).toEqual(["i", "iv", "v"]);
    expect(resolved.every((s) => !s.unavailable)).toBe(true);
    expect(store.get(loadedPresetIdAtom)).toBe("minor-i-iv-v");
    expect(store.get(currentProgressionPresetIdAtom)).toBe("minor-i-iv-v");
  });

  it("loading a Dorian preset switches scale to dorian and reflects the id", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadProgressionPresetAtom, "dorian-i-iv");
    expect(store.get(scaleNameAtom)).toBe("dorian");
    expect(store.get(currentProgressionPresetIdAtom)).toBe("dorian-i-iv");
  });

  it("loading the major I-IV vamp shows the vamp id, not a colliding preset", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    const vamp = generateCommonProgressions("major", "C").find((s) => s.feel === "vamp")!;
    store.set(loadProgressionSuggestionAtom, vamp);
    expect(store.get(scaleNameAtom)).toBe("major");
    expect(store.get(currentProgressionPresetIdAtom)).toBe(vamp.id);
  });

  it("is custom with no loaded id", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadedPresetIdAtom, null);
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    expect(store.get(currentProgressionPresetIdAtom)).toBe(CUSTOM_PRESET_ID);
  });

  it("a fresh store reflects the default progression preset id", () => {
    const store = createStore();
    expect(store.get(currentProgressionPresetIdAtom)).toBe("one-five-six-four");
  });
});
