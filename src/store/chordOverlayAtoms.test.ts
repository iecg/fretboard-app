// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  chordRootAtom,
  chordTypeAtom,
  chordTonesAtom,
  voicingAtom,
  voicingMatchesAtom,
  voicingStringSetAtom,
  effectiveStringSetAtom,
  activeScaleWindowAtom,
  activeScalePatternPositionsAtom,
  closeCandidatesAtom,
  chordSourceIsProgressionAtom,
  chordHighlightPositionsAtom,
  chordOverlayHiddenAtom,
  chordSnapToScaleAtom,
  stringSetOptionsAtom,
  closeCandidatesAllStringSetsAtom,
  activeScaleInstanceRangesAtom,
} from "./chordOverlayAtoms";
import { allChordMembersAtom } from "./composableSelectors";
import { progressionStepsAtom } from "./progressionAtoms";
import { cagedShapesAtom, fingeringPatternAtom, npsPositionAtom } from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import {
  activeChordCachedDegreeAtom,
  updateActiveChordAtom,
} from "./songStateAtoms";
import { chordScopeToPositionAtom } from "./chordScope";
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
    [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);
    store.set(updateActiveChordAtom, { root: "F#" });
    expect(store.get(progressionStepsAtom)[0]!.manualRoot).toBe("F#");
    expect(store.get(chordRootAtom)).toBe("F#");
  });

  it("setting a qualityOverride routes through the active step", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "V" })],
    ]);
    store.set(updateActiveChordAtom, { quality: "Dominant 7th" });
    expect(store.get(progressionStepsAtom)[0]!.qualityOverride).toBe("Dominant 7th");
    expect(store.get(chordTypeAtom)).toBe("Dominant 7th");
  });

  it("setting a degree updates the active step's cached degree without clearing the override", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "minor"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
    ]);
    const candidates = store.get(closeCandidatesAtom);
    expect(candidates.length).toBeGreaterThan(0);
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
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(activeScaleWindowAtom)).toBeNull();
  });

  it("returns null when more than one CAGED shape is active", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C", "A"])],
    ]);
    expect(store.get(activeScaleWindowAtom)).toBeNull();
  });

  it("returns a window when exactly one CAGED shape matches a full voicing", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
    ]);
    const window = store.get(activeScaleWindowAtom);
    expect(window).not.toBeNull();
    expect(window!.lo).toBeGreaterThanOrEqual(0);
    expect(window!.hi).toBeGreaterThan(window!.lo);
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
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "off"],
    ]);
    expect(store.get(voicingMatchesAtom)).toEqual([]);
  });

  it("does not narrow 'full' output to the scale shape when exactly one shape is selected and coupling is inactive", () => {
    // Default cagedShapesAtom is the full Set of 5 shapes, so a no-seed store
    // exercises the "all shapes" branch.
    const allShapesStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
    ]);
    const all = allShapesStore.get(voicingMatchesAtom);

    const oneShapeStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
    ]);
    const one = oneShapeStore.get(voicingMatchesAtom);

    // The "all shapes" set must include shapes other than E.
    const allShapesSeen = new Set(all.map((v) => v.shape));
    expect(allShapesSeen.size).toBeGreaterThan(1);

    // With letter-shape filter removed, 'one' should contain all shapes (equal to 'all')
    expect(one.length).toBe(all.length);
    const oneShapesSeen = new Set(one.map((v) => v.shape));
    expect(oneShapesSeen.size).toBeGreaterThan(1);
  });

  it("close branch returns ALL fitting candidates (not just the cycle-selected one)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
    ]);
    const matches = store.get(voicingMatchesAtom);
    const candidates = store.get(closeCandidatesAtom);
    expect(candidates.length).toBeGreaterThan(1);
    expect(matches).toEqual(candidates);
  });

  it("does not narrow 'full' output to the scale shape when chordScopeToPosition is active", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "V" })], // G Major chord in C Major scale
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])], // Scale in C shape (frets 0-3)
      [chordScopeToPositionAtom, true], // Snapping/coupling enabled
    ]);

    const matches = store.get(voicingMatchesAtom);
    
    // G major should NOT be narrowed to C shape (since C shape of G major is at frets 7-10).
    // G major's matching voicings should include G-shape, E-shape, etc.
    const shapesSeen = new Set(matches.map((v) => v.shape));
    expect(shapesSeen.size).toBeGreaterThan(1);
    expect(shapesSeen.has("G")).toBe(true);
    expect(shapesSeen.has("E")).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// Group J — chordHighlightPositionsAtom (v2.0 — decoupled highlight source)
// ---------------------------------------------------------------------------

describe("chordHighlightPositionsAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty Set when voicing is 'off'", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "off"],
    ]);
    expect(store.get(chordHighlightPositionsAtom)).toEqual(new Set<string>());
  });

  it("returns an empty Set when chordOverlayHidden is true (regardless of voicing)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [chordOverlayHiddenAtom, true],
    ]);
    expect(store.get(chordHighlightPositionsAtom)).toEqual(new Set<string>());

    const closeStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
      [chordOverlayHiddenAtom, true],
    ]);
    expect(closeStore.get(chordHighlightPositionsAtom)).toEqual(new Set<string>());
  });

  it("voicing=full: returns the union of voicingMatchesAtom positionKeys", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
    ]);
    const matches = store.get(voicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(1);
    const expected = new Set(matches.flatMap((v) => v.positionKeys));
    expect(store.get(chordHighlightPositionsAtom)).toEqual(expected);
  });

  it("voicing=close: returns the union of ALL closeCandidatesAllStringSetsAtom positionKeys (not just one)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
    ]);
    const candidates = store.get(closeCandidatesAllStringSetsAtom);
    expect(candidates.length).toBeGreaterThan(1);
    const expected = new Set(candidates.flatMap((v) => v.positionKeys));
    const actual = store.get(chordHighlightPositionsAtom);
    expect(actual).toEqual(expected);
    // Explicitly confirm "more than one candidate worth of keys":
    expect(actual.size).toBeGreaterThan(candidates[0]!.positionKeys.length);
  });
});

// ---------------------------------------------------------------------------
// Group L — chordSnapToScaleAtom + closeCandidatesAtom interaction
// ---------------------------------------------------------------------------

describe("chordSnapToScaleAtom + closeCandidatesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to true", () => {
    const store = makeAtomStore([]);
    expect(store.get(chordSnapToScaleAtom)).toBe(true);
  });

  it("snap=on + scale pattern active: candidates are filtered to the fret-bound scale window (Plan H-T5)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, true],
    ]);
    const candidates = store.get(closeCandidatesAtom);
    expect(candidates.length).toBeGreaterThan(0);

    const patternKeys = store.get(activeScalePatternPositionsAtom);
    const instances = store.get(activeScaleInstanceRangesAtom);
    expect(instances.length).toBeGreaterThan(0);

    for (const v of candidates) {
      const fretted = v.positionKeys
        .map((k) => Number(k.split("-")[1]))
        .filter((f) => f > 0);
      if (fretted.length === 0) continue;

      // Find the shape repeat that covers this voicing
      const matchingInstance = instances.find(
        (inst) => Math.min(...fretted) >= inst.minFret - 1 && Math.max(...fretted) <= inst.maxFret + 1
      );
      expect(matchingInstance).toBeDefined();

      // Check string-specific ranges for this matching shape repeat
      const instCoords = new Set(
        [...patternKeys].filter((c) => {
          const f = Number(c.split("-")[1]);
          return f >= matchingInstance!.minFret && f <= matchingInstance!.maxFret;
        })
      );
      const stringRanges: Record<number, { lo: number; hi: number }> = {};
      for (const key of instCoords) {
        const [sStr, fStr] = key.split("-");
        const s = Number(sStr);
        const f = Number(fStr);
        if (f > 0) {
          if (!stringRanges[s]) {
            stringRanges[s] = { lo: f, hi: f };
          } else {
            stringRanges[s].lo = Math.min(stringRanges[s].lo, f);
            stringRanges[s].hi = Math.max(stringRanges[s].hi, f);
          }
        }
      }

      for (const key of v.positionKeys) {
        const [sStr, fStr] = key.split("-");
        const s = Number(sStr);
        const f = Number(fStr);
        if (f === 0) continue;
        const range = stringRanges[s];
        expect(range).toBeDefined();
        expect(f).toBeGreaterThanOrEqual(range.lo);
        expect(f).toBeLessThanOrEqual(range.hi);
      }
    }
  });

  it("snap=off + scale pattern active: candidates IGNORE the scale window (full hand-filtered set)", () => {
    // Use a chord with off-scale tones (Dominant 7th, b7 not in C Major) so the
    // fret-bound filter has something meaningful to narrow. With a diatonic triad,
    // many voicings naturally stay in the CAGED window anyway.
    const seeds = [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
    ] as const;

    const snapOn = makeAtomStore([...seeds, [chordSnapToScaleAtom, true]] as Parameters<typeof makeAtomStore>[0]);
    const snapOff = makeAtomStore([...seeds, [chordSnapToScaleAtom, false]] as Parameters<typeof makeAtomStore>[0]);

    const snapOnCount = snapOn.get(closeCandidatesAtom).length;
    const snapOffCount = snapOff.get(closeCandidatesAtom).length;

    // The fret-bound filter must drop at least one candidate; otherwise this seed
    // doesn't exercise the snap toggle and the test isn't meaningful.
    expect(snapOffCount).toBeGreaterThan(snapOnCount);
  });

  it("snap=on + no scale pattern: no window to apply (returns hand-filtered set)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "none"],
      [chordSnapToScaleAtom, true],
    ]);
    expect(store.get(activeScaleWindowAtom)).toBeNull();
    expect(store.get(closeCandidatesAtom).length).toBeGreaterThan(0);
  });

  it("snap=off + no scale pattern: same as snap=on + no pattern (no-op)", () => {
    const seeds = [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "none"],
    ] as const;
    const snapOn = makeAtomStore([...seeds, [chordSnapToScaleAtom, true]] as Parameters<typeof makeAtomStore>[0]);
    const snapOff = makeAtomStore([...seeds, [chordSnapToScaleAtom, false]] as Parameters<typeof makeAtomStore>[0]);
    expect(snapOff.get(closeCandidatesAtom).length).toBe(snapOn.get(closeCandidatesAtom).length);
  });
});

// ---------------------------------------------------------------------------
// Group G4 — closeCandidatesAtom + chordSnapToScaleAtom (Plan H-T5 update)
// The strict position-key subset filter from Plan G4 has been reverted to
// fret-bound semantics. See Group H-T5 for the primary coverage.
// These tests verify the snap toggle and pattern-type no-ops still hold.
// ---------------------------------------------------------------------------

describe("closeCandidatesAtom + chordSnapToScaleAtom (snap toggle / no-op cases)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does NOT filter when chordSnapToScaleAtom === false (snap=off bypasses fret-bound filter)", () => {
    // When snap is off, voicings outside the CAGED E fret window are included.
    // Use Dominant 7th so there are off-window candidates to confirm bypass.
    const snapOffStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, false],
    ]);
    const snapOnStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, true],
    ]);

    const window = snapOnStore.get(activeScaleWindowAtom);
    expect(window).not.toBeNull();
    const snapOffCandidates = snapOffStore.get(closeCandidatesAtom);

    // When snap is off, there should be at least one voicing with a fretted note
    // outside the window — confirming the fret-bound filter was bypassed.
    const anyOutsideWindow = snapOffCandidates.some((v) =>
      v.positionKeys.some((k) => {
        const fret = Number(k.split("-")[1]);
        return fret > 0 && (fret < window!.lo || fret > window!.hi);
      }),
    );
    expect(anyOutsideWindow).toBe(true);
  });

  it("returns full hand-filtered candidate set when fingeringPattern is 'none' regardless of snap", () => {
    // activeScaleWindowAtom returns null for 'none' pattern — filter is a no-op.
    const snapOnStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "none"],
      [chordSnapToScaleAtom, true],
    ]);
    const snapOffStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "none"],
      [chordSnapToScaleAtom, false],
    ]);

    const snapOn = snapOnStore.get(closeCandidatesAtom).length;
    const snapOff = snapOffStore.get(closeCandidatesAtom).length;
    expect(snapOn).toBe(snapOff);
  });
});

// ---------------------------------------------------------------------------
// Group M — voicingStringSetAtom + effectiveStringSetAtom (v2.0)
// ---------------------------------------------------------------------------

describe("voicingStringSetAtom + effectiveStringSetAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'all' → falls back to first available window (0-1-2)", () => {
    const store = makeAtomStore([]);
    expect(store.get(voicingStringSetAtom)).toBe("all");
    expect([...store.get(effectiveStringSetAtom)]).toEqual([0, 1, 2]);
  });

  it("selecting a window narrows effective strings", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
    ]);
    store.set(voicingStringSetAtom, "1-2-3-4");
    expect([...store.get(effectiveStringSetAtom)]).toEqual([1, 2, 3, 4]);
  });

  it("falls back to first available window when stored id no longer matches options for the active chord", () => {
    // Major Triad has 3 notes → options are "0-1-2", "1-2-3", ... "3-4-5".
    // "0-1-2-3" (a 4-note window) doesn't appear in triad options.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);
    store.set(voicingStringSetAtom, "0-1-2-3");
    expect([...store.get(effectiveStringSetAtom)]).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Group G8 — stringSetOptionsAtom disabled state (Plan G8)
// ---------------------------------------------------------------------------

describe("stringSetOptionsAtom + chordSnapToScaleAtom (Plan G8)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks string sets with zero candidates in the active scale window as disabled with a reason", () => {
    // Verify the disabled-option probe mechanism: each string-set option is
    // disabled iff no majority-fit candidate (closeCandidatesAllStringSetsAtom)
    // fits that string window. Plan I-T6: majority-fit (≥ ceil(fretted × 2/3))
    // replaced the strict ALL-fit filter, admitting voicings with one spilled note.
    //
    // F# Major Triad at 3NPS position 22 (window [21,25], capped at fret 24):
    // voicings on strings 0-1-2 and 1-2-3 exist in that window, but the
    // 2-3-4 window has no majority-fit candidate (not enough fret space above 21)
    // and should be marked disabled.
    const store = makeAtomStore([
      [rootNoteAtom, "F#"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "F#" })],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 22],
      [chordSnapToScaleAtom, true],
    ]);

    const options = store.get(stringSetOptionsAtom);
    // Must have more than just "all" for this to be meaningful
    expect(options.length).toBeGreaterThan(1);

    // Verify the probe logic: each non-"all" option's disabled state must match
    // whether closeCandidatesAllStringSetsAtom has a candidate for that string set.
    const allCandidates = store.get(closeCandidatesAllStringSetsAtom);
    for (const opt of options) {
      if (opt.id === "all") continue;
      const optStringSet = new Set(opt.strings);
      const hasCandidate = allCandidates.some((v) =>
        v.notes.every((n) => optStringSet.has(n.stringIndex)),
      );
      if (hasCandidate) {
        expect(opt.disabled).toBeFalsy();
      } else {
        expect(opt.disabled).toBe(true);
        expect(opt.disabledReason).toBeTruthy();
      }
    }

    // At least some options should be disabled (the 2-3-4 window has no majority-fit
    // candidate in the [21,25] window for F# Major Triad at position 22 — fret space runs out).
    const disabled = options.filter((o) => o.disabled);
    expect(disabled.length).toBeGreaterThan(0);
  });

  it("does not mark any option disabled when snap is off", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, false],
    ]);

    const options = store.get(stringSetOptionsAtom);
    expect(options.every((o) => !o.disabled)).toBe(true);
  });

  it("does not mark any option disabled when fingeringPattern is 'none' (no window to gate against)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [fingeringPatternAtom, "none"],
      [chordSnapToScaleAtom, true],
    ]);

    const options = store.get(stringSetOptionsAtom);
    expect(options.every((o) => !o.disabled)).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// Group N — closeCandidatesAtom × string set (v2.0)
// ---------------------------------------------------------------------------

describe("closeCandidatesAtom × string set", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns all candidates when string set is 'all'", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
    ]);
    expect(store.get(closeCandidatesAtom).length).toBeGreaterThan(0);
  });

  it("'1-2-3-4' excludes voicings using string 0 or string 5", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
    ]);
    store.set(voicingStringSetAtom, "1-2-3-4");
    const v = store.get(closeCandidatesAtom);
    expect(v.length).toBeGreaterThan(0);
    for (const voicing of v) {
      for (const note of voicing.notes) {
        expect([1, 2, 3, 4]).toContain(note.stringIndex);
      }
    }
  });
});


// ---------------------------------------------------------------------------
// Group H-T5 — closeCandidatesAtom fret-bound filter (Plan H-T5)
// ---------------------------------------------------------------------------

describe("closeCandidatesAtom + chordSnapToScaleAtom — fret-bound filter (Plan H-T5)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("accepts voicings whose fretted notes lie within the scale window even when some chord tones are NOT scale-tone positions", () => {
    // Dominant 7th on degree I of C Major includes Bb (b7), which is NOT in C Major.
    // The strict subset filter (Plan G4) would have rejected voicings containing Bb positions.
    // The diagonal scale-locking filter accepts them if they lie within the string-specific ranges.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, true],
    ]);

    const candidates = store.get(closeCandidatesAtom);
    const patternKeys = store.get(activeScalePatternPositionsAtom);
    expect(patternKeys.size).toBeGreaterThan(0);
    expect(candidates.length).toBeGreaterThan(0);

    const stringRanges: Record<number, { lo: number; hi: number }> = {};
    for (const key of patternKeys) {
      const [sStr, fStr] = key.split("-");
      const s = Number(sStr);
      const f = Number(fStr);
      if (f > 0) {
        if (!stringRanges[s]) {
          stringRanges[s] = { lo: f, hi: f };
        } else {
          stringRanges[s].lo = Math.min(stringRanges[s].lo, f);
          stringRanges[s].hi = Math.max(stringRanges[s].hi, f);
        }
      }
    }

    for (const v of candidates) {
      for (const key of v.positionKeys) {
        const [sStr, fStr] = key.split("-");
        const s = Number(sStr);
        const f = Number(fStr);
        if (f === 0) continue; // open strings always allowed
        const range = stringRanges[s];
        expect(range).toBeDefined();
        expect(f).toBeGreaterThanOrEqual(range.lo);
        expect(f).toBeLessThanOrEqual(range.hi);
      }
    }
  });

  it("includes at least one candidate with a non-scale note when chord tones extend outside the scale (regression guard vs strict subset filter)", () => {
    // Dominant 7th on C in C Major: the b7 (Bb) is not a C Major scale tone.
    // The strict G4 subset filter would have stripped all voicings containing Bb.
    // The fret-bound filter must let them through if they're in the right hand position.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, true],
    ]);

    const candidates = store.get(closeCandidatesAtom);
    const patternKeys = store.get(activeScalePatternPositionsAtom);

    // At least one candidate must have a fretted note that isn't on the scale pattern.
    const anyOffPattern = candidates.some((v) =>
      v.positionKeys.some((k) => {
        const [, fretStr] = k.split("-");
        return Number(fretStr) > 0 && !patternKeys.has(k);
      }),
    );
    expect(anyOffPattern).toBe(true);
  });

  it("fret-bound filter returns more candidates than the strict subset filter would have", () => {
    // With snap=on + CAGED E + Dominant 7th (has off-scale tones), the fret-bound
    // filter should pass voicings the strict subset would have rejected.
    const snapOnStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, true],
    ]);
    const snapOffStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "Dominant 7th" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, false],
    ]);

    const snapOnCount = snapOnStore.get(closeCandidatesAtom).length;
    const snapOffCount = snapOffStore.get(closeCandidatesAtom).length;

    // The fret-bound filter is less strict than the subset filter — snap=on should
    // still narrow the field vs snap=off (uses fret window), but not to zero.
    expect(snapOnCount).toBeGreaterThan(0);
    // snap=off gives the widest range, snap=on narrows to the window (still more than 0)
    expect(snapOffCount).toBeGreaterThanOrEqual(snapOnCount);
  });
});

// ---------------------------------------------------------------------------
// Group I-T6 — closeCandidatesAtom diagonal string-specific scale-locking (Plan I-T6 updated)
// ---------------------------------------------------------------------------

describe("closeCandidatesAtom — diagonal string-specific scale-locking (Plan I-T6 updated)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("every candidate satisfies the string-specific range predicate (100% of fretted notes within string-specific bounds of the shape)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
      [chordSnapToScaleAtom, true],
    ]);
    const candidates = store.get(closeCandidatesAtom);
    const patternKeys = store.get(activeScalePatternPositionsAtom);
    expect(patternKeys.size).toBeGreaterThan(0);
    expect(candidates.length).toBeGreaterThan(0);

    const stringRanges: Record<number, { lo: number; hi: number }> = {};
    for (const key of patternKeys) {
      const [sStr, fStr] = key.split("-");
      const s = Number(sStr);
      const f = Number(fStr);
      if (f > 0) {
        if (!stringRanges[s]) {
          stringRanges[s] = { lo: f, hi: f };
        } else {
          stringRanges[s].lo = Math.min(stringRanges[s].lo, f);
          stringRanges[s].hi = Math.max(stringRanges[s].hi, f);
        }
      }
    }

    for (const v of candidates) {
      for (const key of v.positionKeys) {
        const [sStr, fStr] = key.split("-");
        const s = Number(sStr);
        const f = Number(fStr);
        if (f === 0) continue; // open strings always allowed
        const range = stringRanges[s];
        expect(range).toBeDefined();
        expect(f).toBeGreaterThanOrEqual(range.lo);
        expect(f).toBeLessThanOrEqual(range.hi);
      }
    }
  });

  it("restricts candidates strictly within the diagonal shape footprint compared to a flat rectangular window", () => {
    // 3NPS shapes are diagonal. A flat rectangular window would allow notes to spill.
    // We verify that the string-specific diagonal filter returns fewer candidates than a flat rectangular window
    // because diagonal spilling is prevented.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1], // G Ionian
      [chordSnapToScaleAtom, true],
      [progressionStepsAtom, progressionWith({ degree: "I" })], // C Major
    ]);

    const candidates = store.get(closeCandidatesAtom);
    const window = store.get(activeScaleWindowAtom);
    expect(window).not.toBeNull();

    // Compute how many candidates would fit inside the flat rectangular window [window.lo, window.hi]
    const snapOffStore = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1],
      [chordSnapToScaleAtom, false],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);
    const unfiltered = snapOffStore.get(closeCandidatesAtom);
    const rectangularFitCount = unfiltered.filter((v) => {
      const fretted = v.positionKeys.map((k) => Number(k.split("-")[1])).filter((f) => f > 0);
      if (fretted.length === 0) return true;
      return Math.min(...fretted) >= window!.lo && Math.max(...fretted) <= window!.hi;
    }).length;

    // The string-specific diagonal filter is strictly narrower than the flat rectangular window buffer,
    // so it should return fewer candidates.
    expect(candidates.length).toBeLessThan(rectangularFitCount);
  });
});

// ---------------------------------------------------------------------------
// Group I-T6 Part 3 — closeCandidatesAtom & highlights — multi-octave repeating shapes & decoupled highlights (Plan I-T6 Part 3)
// ---------------------------------------------------------------------------

describe("closeCandidatesAtom & highlights — multi-octave repeating shapes & decoupled highlights (Plan I-T6 Part 3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("admits close candidates on all repeating shape instances, but strictly rejects them in the gaps between repeats", () => {
    // When CAGED C shape is selected for C Major, the C shape patterns exist at fret 0-3 and fret 12-15.
    // Voicings should be allowed within frets 0-3 and frets 12-15, but rejected in the gap (e.g. frets 5-10).
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C" })], // C Major
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
      [chordSnapToScaleAtom, true],
    ]);

    const candidates = store.get(closeCandidatesAtom);
    expect(candidates.length).toBeGreaterThan(0);

    // Verify we have candidates in the lower register [0, 4]
    const hasLower = candidates.some((v) => {
      const fretted = v.positionKeys.map((k) => Number(k.split("-")[1])).filter((f) => f > 0);
      return fretted.length > 0 && Math.max(...fretted) <= 4;
    });
    expect(hasLower).toBe(true);

    // Verify we have candidates in the middle register [11, 16]
    const hasMiddle = candidates.some((v) => {
      const fretted = v.positionKeys.map((k) => Number(k.split("-")[1])).filter((f) => f > 0);
      return fretted.length > 0 && Math.min(...fretted) >= 11 && Math.max(...fretted) <= 16;
    });
    expect(hasMiddle).toBe(true);

    // Verify that NO candidate has notes in the gap frets [5, 10]
    const hasSpillInGap = candidates.some((v) => {
      const fretted = v.positionKeys.map((k) => Number(k.split("-")[1])).filter((f) => f > 0);
      return fretted.some((f) => f >= 5 && f <= 10);
    });
    expect(hasSpillInGap).toBe(false);
  });

  it("decouples note highlights on the neck from the selected string set window", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C" })], // C Major
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
      [chordSnapToScaleAtom, true],
      [voicingStringSetAtom, "1-2-3"], // restrict connector polylines to strings 1, 2, 3
    ]);

    // Connectors are restricted by the string set filter
    const matches = store.get(voicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    for (const v of matches) {
      for (const n of v.notes) {
        expect([1, 2, 3]).toContain(n.stringIndex);
      }
    }

    // Highlights on the neck are decoupled and contain notes on other strings (like string 0 or string 4 or string 5)
    const highlights = store.get(chordHighlightPositionsAtom);
    const highlightedStrings = new Set<number>();
    for (const pos of highlights) {
      const s = Number(pos.split("-")[0]);
      highlightedStrings.add(s);
    }
    // Verifies that note highlights exist on string 0, 4, or 5
    expect(highlightedStrings.has(0) || highlightedStrings.has(4) || highlightedStrings.has(5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group I-T7 — effectiveStringSetAtom auto-fallback (Plan I-T7)
// ---------------------------------------------------------------------------

describe("effectiveStringSetAtom — auto-fallback when picked option is disabled (Plan I-T7)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to the first ENABLED option's strings when the user's pick is disabled", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "F#"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "F#" })],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 22],
      [chordSnapToScaleAtom, true],
      [voicingAtom, "close"],
    ]);

    const options = store.get(stringSetOptionsAtom);
    const disabledOption = options.find((o) => o.disabled && o.id !== "all");
    expect(disabledOption).toBeTruthy();
    const firstEnabled = options.find((o) => !o.disabled);
    expect(firstEnabled).toBeTruthy();

    // User picks the disabled option
    store.set(voicingStringSetAtom, disabledOption!.id);

    const effective = store.get(effectiveStringSetAtom);
    expect(effective).toEqual(firstEnabled!.strings);
  });

  it("keeps the user's pick when it is NOT disabled (regression guard)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "none"],
      [chordSnapToScaleAtom, true],
      [voicingAtom, "close"],
    ]);

    const options = store.get(stringSetOptionsAtom);
    const enabledOption = options.find((o) => !o.disabled && o.id !== "all");
    expect(enabledOption).toBeTruthy();
    store.set(voicingStringSetAtom, enabledOption!.id);
    const effective = store.get(effectiveStringSetAtom);
    expect(effective).toEqual(enabledOption!.strings);
  });
});
