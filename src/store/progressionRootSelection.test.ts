import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import {
  progressionStepsAtom,
  qualityLockAtom,
  selectProgressionStepRootAtom,
} from "./progressionAtoms";

function seed(store: ReturnType<typeof createStore>) {
  store.set(progressionStepsAtom, [
    { id: "s1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "maj7", manualRoot: null },
  ]);
}

describe("selectProgressionStepRootAtom", () => {
  let store: ReturnType<typeof createStore>;
  beforeEach(() => {
    store = createStore();
    seed(store);
  });

  it("in-scale selection clears manualRoot, sets degree, clears qualityOverride (lock off)", () => {
    store.set(selectProgressionStepRootAtom, { id: "s1", root: "F", numeral: "IV", inScale: true });
    const step = store.get(progressionStepsAtom)[0];
    expect(step.manualRoot).toBeNull();
    expect(step.degree).toBe("IV");
    expect(step.qualityOverride).toBeNull();
  });

  it("borrowed selection sets manualRoot + cached numeral, clears qualityOverride (lock off)", () => {
    store.set(selectProgressionStepRootAtom, { id: "s1", root: "A#", numeral: "bVII", inScale: false });
    const step = store.get(progressionStepsAtom)[0];
    expect(step.manualRoot).toBe("A#");
    expect(step.degree).toBe("bVII");
    expect(step.qualityOverride).toBeNull();
  });

  it("preserves qualityOverride when the lock is on", () => {
    store.set(qualityLockAtom, true);
    store.set(selectProgressionStepRootAtom, { id: "s1", root: "G", numeral: "V", inScale: true });
    const step = store.get(progressionStepsAtom)[0];
    expect(step.qualityOverride).toBe("maj7");
  });
});
