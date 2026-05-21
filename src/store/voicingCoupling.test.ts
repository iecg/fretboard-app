// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  validVoicingCombosAtom,
  controlRecencyAtom,
  nearestValidTriple,
  type VoicingTriple,
} from "./voicingCoupling";
import { progressionStepsAtom } from "./progressionAtoms";
import { makeAtomStore } from "../test-utils/renderWithAtoms";

// Phase 2.5: seed a single manual-root progression step so the chord under
// test (C Major Triad) is what `chordRootAtom` / `chordTypeAtom` resolve to.
function seedTriadChord() {
  const store = makeAtomStore();
  store.set(progressionStepsAtom, [
    {
      id: "step-1",
      degree: "I",
      duration: { value: 1, unit: "bar" },
      qualityOverride: "Major Triad",
      manualRoot: "C",
    },
  ]);
  return store;
}

describe("validVoicingCombosAtom", () => {
  it("reports the enabled types, inversions and string sets for a triad chord", () => {
    const store = seedTriadChord();
    const combos = store.get(validVoicingCombosAtom);
    expect(combos.enabledTypes.has("caged")).toBe(true);
    expect(combos.enabledTypes.has("triad") || combos.enabledTypes.has("drop2")).toBe(true);
    expect(combos.enabledStringSets.has("all")).toBe(true);
    expect(combos.enabledInversions.has("root")).toBe(true);
  });

  it("disables only options absent from every valid triple", () => {
    const store = seedTriadChord();
    const combos = store.get(validVoicingCombosAtom);
    for (const t of combos.enabledTypes) {
      if (t === "caged") continue;
      expect(combos.triples.some((c) => c.type === t)).toBe(true);
    }
    for (const inv of combos.enabledInversions) {
      expect(combos.triples.some((c) => c.inversion === inv)).toBe(true);
    }
    for (const ss of combos.enabledStringSets) {
      expect(combos.triples.some((c) => c.stringSet === ss)).toBe(true);
    }
  });
});

describe("nearestValidTriple", () => {
  const triples: VoicingTriple[] = [
    { type: "triad", inversion: "root", stringSet: "all" },
    { type: "triad", inversion: "root", stringSet: "4·5·6" },
    { type: "triad", inversion: "1st", stringSet: "all" },
    { type: "drop2", inversion: "root", stringSet: "all" },
  ];

  it("keeps the pinned control and prefers keeping the more-recently-touched sibling", () => {
    const current: VoicingTriple = { type: "drop2", inversion: "1st", stringSet: "all" };
    const recency = ["type", "stringSet", "inversion"] as const;
    const result = nearestValidTriple(triples, current, recency);
    expect(result.type).toBe("drop2");
    expect(result.stringSet).toBe("all");
    expect(result.inversion).toBe("root");
  });

  it("moves the less-recent sibling when the more-recent one can be kept", () => {
    const current: VoicingTriple = { type: "triad", inversion: "1st", stringSet: "4·5·6" };
    const recency = ["inversion", "type", "stringSet"] as const;
    const result = nearestValidTriple(triples, current, recency);
    expect(result.inversion).toBe("1st");
    expect(result.type).toBe("triad");
    expect(result.stringSet).toBe("all");
  });

  it("returns the current triple unchanged when it is already valid", () => {
    const current: VoicingTriple = { type: "triad", inversion: "root", stringSet: "all" };
    const recency = ["type", "inversion", "stringSet"] as const;
    expect(nearestValidTriple(triples, current, recency)).toEqual(current);
  });
});

describe("controlRecencyAtom", () => {
  it("has a default order that is type → stringSet → inversion", () => {
    const store = makeAtomStore();
    expect(store.get(controlRecencyAtom)).toEqual([
      "type", "stringSet", "inversion",
    ]);
  });
});
