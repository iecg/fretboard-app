import { describe, it, expect } from "vitest";
import { createStore } from "jotai";
import {
  urlOverridesAtom,
  effectiveRootNoteAtom,
  effectiveScaleNameAtom,
  effectiveTempoAtom,
  effectiveBeatsPerBarAtom,
  effectiveTimeSignatureDenominatorAtom,
  effectiveProgressionStepsAtom,
  clearUrlOverridesAtom,
} from "./urlOverrideAtoms";
import { baseRootNoteAtom } from "./scaleAtoms";
import type { ShareState } from "../utils/shareCodec";
import type { ProgressionStep } from "../progressions/progressionDomain";

describe("urlOverrideAtoms", () => {
  it("effective atoms return persisted values when no overrides", () => {
    const store = createStore();
    store.set(baseRootNoteAtom, "G");
    expect(store.get(effectiveRootNoteAtom)).toBe("G");
    expect(store.get(urlOverridesAtom)).toBeNull();
  });

  it("effective atoms return override values when set", () => {
    const store = createStore();
    store.set(baseRootNoteAtom, "G");
    const overrides: ShareState = {
      root: "C",
      scale: "minor",
      tempo: 100,
      timeSignature: { numerator: 3, denominator: 4 },
      steps: [
        { degree: "i", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    store.set(urlOverridesAtom, overrides);
    expect(store.get(effectiveRootNoteAtom)).toBe("C");
    expect(store.get(effectiveScaleNameAtom)).toBe("minor");
    expect(store.get(effectiveTempoAtom)).toBe(100);
    expect(store.get(effectiveBeatsPerBarAtom)).toBe(3);
    expect(store.get(effectiveTimeSignatureDenominatorAtom)).toBe(4);
  });

  it("effective progression steps converts ShareState steps to ProgressionSteps", () => {
    const store = createStore();
    const overrides: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: "7", duration: { value: 2, unit: "bar" } },
      ],
    };
    store.set(urlOverridesAtom, overrides);
    const steps = store.get(effectiveProgressionStepsAtom) as ProgressionStep[];
    expect(steps).toHaveLength(2);
    expect(steps[0].degree).toBe("I");
    expect(steps[0].qualityOverride).toBeNull();
    expect(steps[1].degree).toBe("V");
    expect(steps[1].qualityOverride).toBe("7");
    expect(steps[1].duration).toEqual({ value: 2, unit: "bar" });
    // Each step gets a generated id
    expect(typeof steps[0].id).toBe("string");
    expect(steps[0].id).not.toBe(steps[1].id);
  });

  it("clearUrlOverridesAtom sets overrides to null", () => {
    const store = createStore();
    const overrides: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [{ degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } }],
    };
    store.set(urlOverridesAtom, overrides);
    expect(store.get(urlOverridesAtom)).not.toBeNull();
    store.set(clearUrlOverridesAtom);
    expect(store.get(urlOverridesAtom)).toBeNull();
  });
});
