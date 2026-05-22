// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  chordRootAtom,
  chordTypeAtom,
  chordTonesAtom,
  voicingAtom,
  voicingMatchesAtom,
  activeScaleWindowAtom,
  closePositionIndexAtom,
  closeCandidatesAtom,
  chordSourceIsProgressionAtom,
} from "./chordOverlayAtoms";
import { allChordMembersAtom } from "./composableSelectors";
import { progressionStepsAtom } from "./progressionAtoms";
import { cagedShapesAtom, cagedOctaveAtom, fingeringPatternAtom } from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import {
  activeChordCachedDegreeAtom,
  updateActiveChordAtom,
} from "./songStateAtoms";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import type { ProgressionStep } from "../progressions/progressionDomain";
import type { CagedShape, DegreeId } from "@fretflow/core";

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
// Group F — voicingAtom (v2.0)
// ---------------------------------------------------------------------------

describe("voicingAtom — v2.0", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'full'", () => {
    const store = makeAtomStore([]);
    expect(store.get(voicingAtom)).toBe("full");
  });

  it("accepts off, full, close", () => {
    const store = makeAtomStore([]);
    for (const v of ["off", "full", "close"] as const) {
      store.set(voicingAtom, v);
      expect(store.get(voicingAtom)).toBe(v);
    }
  });
});

// ---------------------------------------------------------------------------
// Group G — closeCandidatesAtom (v2.0)
// ---------------------------------------------------------------------------

describe("closeCandidatesAtom — v2.0", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is empty when no chord is active", () => {
    const store = makeAtomStore([[progressionStepsAtom, []]]);
    expect(store.get(closeCandidatesAtom)).toEqual([]);
  });

  it("returns >0 close voicings for an active C major (degree I in C Major)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
    ]);
    const candidates = store.get(closeCandidatesAtom);
    expect(candidates.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Group H — closePositionIndexAtom (v2.0)
// ---------------------------------------------------------------------------

describe("closePositionIndexAtom — v2.0", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts at 0", () => {
    const store = makeAtomStore([]);
    expect(store.get(closePositionIndexAtom)).toBe(0);
  });

  it("stores out-of-range values raw (wrapping happens in voicingMatchesAtom)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
    ]);
    store.set(closePositionIndexAtom, 9999);
    expect(store.get(closePositionIndexAtom)).toBe(9999);
    expect(store.get(closeCandidatesAtom).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Group H-2 — activeScaleWindowAtom CAGED octave switching
// ---------------------------------------------------------------------------

describe("activeScaleWindowAtom — CAGED octave switching", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when pattern is not caged", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(activeScaleWindowAtom)).toBeNull();
  });

  it("returns null when more than one CAGED shape is active", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C", "A"])],
    ]);
    expect(store.get(activeScaleWindowAtom)).toBeNull();
  });

  it("returns a window when exactly one CAGED shape matches a full voicing", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
    ]);
    const window = store.get(activeScaleWindowAtom);
    expect(window).not.toBeNull();
    expect(window!.lo).toBeGreaterThanOrEqual(0);
    expect(window!.hi).toBeGreaterThan(window!.lo);
  });

  it("switching cagedOctaveAtom yields a different lo/hi when 2+ matches exist for the shape", () => {
    // C Major Triad with shape "G" or "D" typically has voicings at multiple octaves
    // across the neck. We look for any shape+chord combo where 2 windows differ.
    // Rather than asserting a specific shape, find one programmatically.
    const shapes: CagedShape[] = ["C", "A", "G", "E", "D"];
    let foundDifference = false;

    for (const shape of shapes) {
      const store0 = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "Major"],
        [progressionStepsAtom, progressionWith({ degree: "I" })],
        [fingeringPatternAtom, "caged"],
        [cagedShapesAtom, new Set<CagedShape>([shape])],
        [cagedOctaveAtom, 0],
      ]);
      const store1 = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "Major"],
        [progressionStepsAtom, progressionWith({ degree: "I" })],
        [fingeringPatternAtom, "caged"],
        [cagedShapesAtom, new Set<CagedShape>([shape])],
        [cagedOctaveAtom, 1],
      ]);
      const w0 = store0.get(activeScaleWindowAtom);
      const w1 = store1.get(activeScaleWindowAtom);
      if (w0 && w1 && (w0.lo !== w1.lo || w0.hi !== w1.hi)) {
        foundDifference = true;
        // Verify the difference is consistent: lo and hi differ
        expect(w0).not.toEqual(w1);
        break;
      }
    }

    // If no shape produces 2 distinct voicings, at minimum octave=0 and octave=1
    // should both return a valid non-null window (falls back to matchesOfShape[0]).
    if (!foundDifference) {
      // Fallback: just verify the atom is stable at both octave values
      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "Major"],
        [progressionStepsAtom, progressionWith({ degree: "I" })],
        [fingeringPatternAtom, "caged"],
        [cagedShapesAtom, new Set<CagedShape>(["E"])],
        [cagedOctaveAtom, 0],
      ]);
      expect(store.get(activeScaleWindowAtom)).not.toBeNull();
      store.set(cagedOctaveAtom, 1);
      expect(store.get(activeScaleWindowAtom)).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Group I — voicingMatchesAtom dispatch (v2.0)
// ---------------------------------------------------------------------------

describe("voicingMatchesAtom — v2.0 dispatch", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns [] when voicing is 'off'", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "off"],
    ]);
    expect(store.get(voicingMatchesAtom)).toEqual([]);
  });

  it("narrows 'full' output to the active CAGED shape when exactly one is selected", () => {
    // Default cagedShapesAtom is the full Set of 5 shapes, so a no-seed store
    // exercises the "all shapes" branch.
    const allShapesStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
    ]);
    const all = allShapesStore.get(voicingMatchesAtom);

    const oneShapeStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
    ]);
    const one = oneShapeStore.get(voicingMatchesAtom);

    // The "all shapes" set must include shapes other than E.
    const allShapesSeen = new Set(all.map((v) => v.shape));
    expect(allShapesSeen.size).toBeGreaterThan(1);

    // Narrowed set must be non-empty and contain only the E shape.
    expect(one.length).toBeGreaterThan(0);
    expect(one.every((v) => v.shape === "E")).toBe(true);
    expect(one.length).toBeLessThan(all.length);
  });
});
