// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  chordRootAtom,
  chordTypeAtom,
  chordTonesAtom,
  availableInversionsAtom,
  voicingMatchesAtom,
  voicingConnectorsAtom,
  fullChordsEnabledAtom,
  stringSetOptionsAtom,
  effectiveStringSetAtom,
  voicingTypeAtom,
  voicingInversionAtom,
  voicingStringSetAtom,
  chordSourceIsProgressionAtom,
} from "./chordOverlayAtoms";
import { allChordMembersAtom } from "./composableSelectors";
import { progressionStepsAtom } from "./progressionAtoms";
import { fingeringPatternAtom } from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import {
  activeChordCachedDegreeAtom,
  updateActiveChordAtom,
} from "./songStateAtoms";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import type { ProgressionStep } from "../progressions/progressionDomain";
import type { DegreeId } from "@fretflow/core";

const STEP_DEFAULTS = {
  duration: { value: 1, unit: "bar" as const },
  qualityOverride: null,
  manualRoot: null,
};

function progressionWith(
  patch: Partial<Omit<ProgressionStep, "id">> & { degree: DegreeId },
): ProgressionStep[] {
  return [{ id: "step-1", ...STEP_DEFAULTS, ...patch }];
}

// ---------------------------------------------------------------------------
// Group A — chordRootAtom + chordTypeAtom read paths
// ---------------------------------------------------------------------------

describe("chordRootAtom / chordTypeAtom — derived from active progression step", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const C_MAJOR_SEEDS = [
    [rootNoteAtom, "C"],
    [scaleNameAtom, "Major"],
  ] as const;

  it.each<{ degree: DegreeId; root: string; type: string }>([
    { degree: "I", root: "C", type: "Major Triad" },
    { degree: "vi", root: "A", type: "Minor Triad" },
  ])("degree=$degree resolves diatonically (root=$root, type=$type) in C Major", ({ degree, root, type }) => {
    const store = makeAtomStore([
      ...C_MAJOR_SEEDS,
      [progressionStepsAtom, progressionWith({ degree })],
    ]);
    expect(store.get(chordRootAtom)).toBe(root);
    expect(store.get(chordTypeAtom)).toBe(type);
  });

  it("chordTypeAtom returns null when the progression is empty (overlay off)", () => {
    const store = makeAtomStore([[progressionStepsAtom, []]]);
    expect(store.get(chordTypeAtom)).toBeNull();
  });

  it("manualRoot overrides the diatonic root; qualityOverride overrides the quality", () => {
    const store = makeAtomStore([
      ...C_MAJOR_SEEDS,
      [progressionStepsAtom, progressionWith({ degree: "V", manualRoot: "F#", qualityOverride: "Dominant 7th" })],
    ]);
    expect(store.get(chordRootAtom)).toBe("F#");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it("qualityOverride applies on top of the diatonic root", () => {
    const store = makeAtomStore([
      ...C_MAJOR_SEEDS,
      [progressionStepsAtom, progressionWith({ degree: "V", qualityOverride: "Dominant 7th" })],
    ]);
    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });
});

// ---------------------------------------------------------------------------
// Group B — updateActiveChordAtom writes
// ---------------------------------------------------------------------------

describe("updateActiveChordAtom — write surface", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("setting a manualRoot routes through the active step", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);
    store.set(updateActiveChordAtom, { root: "F#" });
    expect(store.get(progressionStepsAtom)[0]!.manualRoot).toBe("F#");
    expect(store.get(chordRootAtom)).toBe("F#");
  });

  it("setting a qualityOverride routes through the active step", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "V" })],
    ]);
    store.set(updateActiveChordAtom, { quality: "Dominant 7th" });
    expect(store.get(progressionStepsAtom)[0]!.qualityOverride).toBe("Dominant 7th");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it("setting a degree updates the active step's cached degree without clearing the override", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I", qualityOverride: "Dominant 7th" })],
    ]);
    store.set(updateActiveChordAtom, { degree: "V" });
    expect(store.get(activeChordCachedDegreeAtom)).toBe("V");
    expect(store.get(progressionStepsAtom)[0]!.qualityOverride).toBe("Dominant 7th");
  });
});

// ---------------------------------------------------------------------------
// Group C — chordSourceIsProgressionAtom
// ---------------------------------------------------------------------------

describe("chordSourceIsProgressionAtom", () => {
  it("is false when there is no resolvable progression step", () => {
    const store = makeAtomStore([[progressionStepsAtom, []]]);
    expect(store.get(chordSourceIsProgressionAtom)).toBe(false);
  });

  it("is true when a step resolves diatonically", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);
    expect(store.get(chordSourceIsProgressionAtom)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group D — allChordMembersAtom.scaleDegree / scaleInterval
// ---------------------------------------------------------------------------

describe("allChordMembersAtom — scaleDegree + scaleInterval", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("in-scale note E gets scaleDegree 'iii' in C Major I chord", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);
    const members = store.get(allChordMembersAtom);
    const eEntry = members.find((m) => m.internalNote === "E");
    expect(eEntry).toBeDefined();
    expect(eEntry!.scaleDegree).toBe("iii");
  });

  it("in-scale root note C gets scaleDegree 'I' in C Major I chord", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);
    const members = store.get(allChordMembersAtom);
    const cEntry = members.find((m) => m.internalNote === "C");
    expect(cEntry).toBeDefined();
    expect(cEntry!.scaleDegree).toBe("I");
  });

  it("out-of-scale chord tone has scaleDegree undefined", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "D", qualityOverride: "Major Triad" })],
    ]);
    const members = store.get(allChordMembersAtom);
    // D Major = D, F#, A. F# is not in C Major scale.
    const fSharpEntry = members.find((m) => m.internalNote === "F#");
    expect(fSharpEntry).toBeDefined();
    expect(fSharpEntry!.inScale).toBe(false);
    expect(fSharpEntry!.scaleDegree).toBeUndefined();
  });

  it("Case 1: C Major + Eb7 — all four chord tones get correct scale-relative scaleInterval", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "D#", qualityOverride: "Dominant 7th" })],
    ]);
    const members = store.get(allChordMembersAtom);

    const ebEntry = members.find((m) => m.internalNote === "D#");
    expect(ebEntry!.inScale).toBe(false);
    expect(ebEntry!.scaleInterval).toBe("♭3");

    const gEntry = members.find((m) => m.internalNote === "G");
    expect(gEntry!.inScale).toBe(true);
    expect(gEntry!.scaleInterval).toBe("5");

    const bbEntry = members.find((m) => m.internalNote === "A#");
    expect(bbEntry!.inScale).toBe(false);
    expect(bbEntry!.scaleInterval).toBe("♭7");

    const dbEntry = members.find((m) => m.internalNote === "C#");
    expect(dbEntry!.inScale).toBe(false);
    expect(dbEntry!.scaleInterval).toBe("♭2");
  });

  it("Case 2: A Natural Minor + E7 — G# (only out-of-scale note) gets scaleInterval='7'", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "A"],
      [scaleNameAtom, "Natural Minor"],
      [progressionStepsAtom, progressionWith({ degree: "i", manualRoot: "E", qualityOverride: "Dominant 7th" })],
    ]);
    const members = store.get(allChordMembersAtom);

    const gsEntry = members.find((m) => m.internalNote === "G#");
    expect(gsEntry!.inScale).toBe(false);
    expect(gsEntry!.scaleInterval).toBe("7");
  });

  it("Case 3: C Major + Augmented Triad — G# is out-of-scale with scaleInterval='b6'", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Augmented Triad" })],
    ]);
    const members = store.get(allChordMembersAtom);

    const cEntry = members.find((m) => m.internalNote === "C");
    expect(cEntry!.inScale).toBe(true);
    expect(cEntry!.scaleInterval).toBe("1");

    const eEntry = members.find((m) => m.internalNote === "E");
    expect(eEntry!.inScale).toBe(true);
    expect(eEntry!.scaleInterval).toBe("3");

    const gsEntry = members.find((m) => m.internalNote === "G#");
    expect(gsEntry!.inScale).toBe(false);
    expect(gsEntry!.scaleInterval).toBe("♭6");
  });
});

// ---------------------------------------------------------------------------
// Group E — chord overlay independent of fingering pattern (regression)
// ---------------------------------------------------------------------------

describe("chord overlay independent of fingering pattern", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each(["one-string", "two-strings"] as const)(
    "chord tones still render with %s fingering",
    (pattern) => {
      const store = makeAtomStore([
        [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Major Triad" })],
        [fingeringPatternAtom, pattern],
      ]);
      expect(store.get(chordTonesAtom).length).toBeGreaterThan(0);
    },
  );

  it("progression is the active chord source even with one-string fingering", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "V" })],
      [fingeringPatternAtom, "one-string"],
    ]);
    expect(store.get(chordSourceIsProgressionAtom)).toBe(true);
    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordTypeAtom)).toBe("Major Triad");
  });
});

// ---------------------------------------------------------------------------
// Group F — voicing string set
// ---------------------------------------------------------------------------

describe("voicing string set", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const manualC = (quality: string) => [
    [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: quality })],
  ] as const;

  it.each<{ quality: string; ids: string[] }>([
    { quality: "Major Triad", ids: ["all", "4·5·6", "3·4·5", "2·3·4", "1·2·3"] },
    { quality: "Major 7th", ids: ["all", "3·4·5·6", "2·3·4·5", "1·2·3·4"] },
  ])("string-set options match tone count for $quality", ({ quality, ids }) => {
    const store = makeAtomStore([...manualC(quality)]);
    expect(store.get(stringSetOptionsAtom).map((o) => o.id)).toEqual(ids);
  });

  it.each<{ label: string; quality: string; expected: number[] }>([
    { label: "valid stored id resolves to its string-index array", quality: "Major Triad", expected: [3, 4, 5] },
    { label: "invalid stored id for chord falls back to all six strings", quality: "Major 7th", expected: [0, 1, 2, 3, 4, 5] },
  ])("effectiveStringSetAtom: $label", ({ quality, expected }) => {
    const store = makeAtomStore([
      ...manualC(quality),
      [voicingStringSetAtom, "4·5·6"],
    ]);
    expect(store.get(effectiveStringSetAtom)).toEqual(expected);
  });

  it("voicingMatchesAtom returns engine output for a valid triad window", () => {
    const store = makeAtomStore([
      ...manualC("Major Triad"),
      [voicingTypeAtom, "triad"],
      [voicingStringSetAtom, "4·5·6"],
    ]);
    const matches = store.get(voicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      for (const n of m.notes) expect([3, 4, 5]).toContain(n.stringIndex);
    }
  });

  it("ignores the string set and inversion while voicingType is caged", () => {
    const store = makeAtomStore([
      ...manualC("Major Triad"),
      [voicingTypeAtom, "caged"],
      [voicingStringSetAtom, "1·2·3"],
      [voicingInversionAtom, "2nd"],
    ]);
    const matches = store.get(voicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.shape !== undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group G — voicing atoms
// ---------------------------------------------------------------------------

describe("voicing atoms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each<{ quality: string; inversions: string[] }>([
    { quality: "Major Triad", inversions: ["root", "1st", "2nd"] },
    { quality: "Major 7th", inversions: ["root", "1st", "2nd", "3rd"] },
    { quality: "Power Chord (5)", inversions: ["root"] },
  ])("availableInversionsAtom for $quality → $inversions", ({ quality, inversions }) => {
    const store = makeAtomStore([
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: quality })],
    ]);
    expect(store.get(availableInversionsAtom)).toEqual(inversions);
  });

  it("voicingMatchesAtom returns engine output when a chord is active, regardless of Full Chords", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Major Triad" })],
      [fullChordsEnabledAtom, false],
    ]);
    expect(store.get(voicingMatchesAtom).length).toBeGreaterThan(0);
  });

  it("voicingConnectorsAtom defaults to true", () => {
    const store = makeAtomStore();
    expect(store.get(voicingConnectorsAtom)).toBe(true);
  });
});
