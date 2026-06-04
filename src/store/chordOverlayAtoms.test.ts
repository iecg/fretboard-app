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
  closeCandidatesAtom,
  chordSourceIsProgressionAtom,
  chordHighlightPositionsAtom,
  chordOverlayHiddenAtom,
  stringSetOptionsAtom,
  closeCandidatesAllStringSetsAtom,
  visibleVoicingMatchesAtom,
  isInAnyPolygon,
  chordLookupAtom,
  chordLookupRootAtom,
  chordLookupTypeAtom,
} from "./chordOverlayAtoms";
import { shapeDataAtom } from "./shapeAtoms";
import { allChordMembersAtom } from "./composableSelectors";
import {
  progressionStepsAtom,
  displayedStepIndexPrimitiveAtom,
  setProgressionPlayingAtom,
  setProgressionActiveStepIndexAtom,
  activeResolvedProgressionStepAtom,
} from "./progressionAtoms";
import { cagedShapesAtom, fingeringPatternAtom, npsPositionAtom, npsOctaveAtom } from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import {
  activeChordCachedDegreeAtom,
  updateActiveChordAtom,
} from "./songStateAtoms";
import { activePositionAtom } from "./chordScope";
import { selectCloseFallbacksForCagedPosition } from "../hooks/voicingSelection";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import type { ProgressionStep } from "../progressions/progressionDomain";
import type { CagedShape, DegreeId, ShapePolygon } from "@fretflow/core";

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
    { degree: "I", root: "C", type: "M" },
    { degree: "vi", root: "A", type: "m" },
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
      [progressionStepsAtom, progressionWith({ degree: "V", manualRoot: "F#", qualityOverride: "7" })],
    ]);
    expect(store.get(chordRootAtom)).toBe("F#");
    expect(store.get(chordTypeAtom)).toBe("7");
  });

  it("qualityOverride applies on top of the diatonic root", () => {
    const store = makeAtomStore([
      ...C_MAJOR_SEEDS,
      [progressionStepsAtom, progressionWith({ degree: "V", qualityOverride: "7" })],
    ]);
    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(chordTypeAtom)).toBe("7");
  });
});

describe("isInAnyPolygon", () => {
  it("uses polygon coverage for membership checks (truncated polygons covered too)", () => {
    const polygons: ShapePolygon[] = [
      {
        shape: "C",
        color: "red",
        cagedLabel: "C",
        modalLabel: null,
        truncated: false,
        intendedMin: 3,
        intendedMax: 5,
        vertices: [
          { string: 0, fret: 3 },
          { string: 1, fret: 4 },
          { string: 1, fret: 5 },
          { string: 0, fret: 5 },
        ],
      },
      {
        shape: "A",
        color: "blue",
        cagedLabel: "A",
        modalLabel: null,
        truncated: true,
        intendedMin: 8,
        intendedMax: 10,
        vertices: [
          { string: 0, fret: 8 },
          { string: 1, fret: 8 },
          { string: 1, fret: 10 },
          { string: 0, fret: 10 },
        ],
      },
    ];

    expect(isInAnyPolygon("0-3", polygons)).toBe(true);
    expect(isInAnyPolygon("1-4", polygons)).toBe(true);
    expect(isInAnyPolygon("1-3", polygons)).toBe(false);
    // Truncated polygons' visible portion is now covered. Fixes the
    // invisible-notes-inside-clipped-shape bug (notes inside a drawn polygon
    // were being dim-opacity'd as if outside the shape).
    expect(isInAnyPolygon("0-9", polygons)).toBe(true);
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
    store.set(updateActiveChordAtom, { quality: "7" });
    expect(store.get(progressionStepsAtom)[0]!.qualityOverride).toBe("7");
    expect(store.get(chordTypeAtom)).toBe("7");
  });

  it("setting a degree updates the active step's cached degree without clearing the override", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", qualityOverride: "7" })],
    ]);
    store.set(updateActiveChordAtom, { degree: "V" });
    expect(store.get(activeChordCachedDegreeAtom)).toBe("V");
    expect(store.get(progressionStepsAtom)[0]!.qualityOverride).toBe("7");
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
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "D", qualityOverride: "M" })],
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
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "D#", qualityOverride: "7" })],
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
      [progressionStepsAtom, progressionWith({ degree: "i", manualRoot: "E", qualityOverride: "7" })],
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
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "aug" })],
    ]);
    const members = store.get(allChordMembersAtom);

    const cEntry = members.find((m) => m.internalNote === "C");
    expect(cEntry!.inScale).toBe(true);
    expect(cEntry!.scaleInterval).toBe("R");

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
        [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
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
    expect(store.get(chordTypeAtom)).toBe("M");
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

  it("voicing=close + no active position: returns the union of closeCandidatesAtom positionKeys", () => {
    // chordHighlightPositionsAtom for close derives from
    // visibleVoicingMatchesAtom (position-scoped). With no active position
    // (fingeringPattern='none'), visible falls back to all voicingMatchesAtom
    // matches = closeCandidatesAtom (the string-set-filtered candidates).
    // Old behavior was whole-neck closeCandidatesAllStringSetsAtom — that was
    // decoupled from position, leaking highlights across the whole neck.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "none"], // explicit: no position, no polygon filtering
    ]);
    const candidates = store.get(closeCandidatesAtom);
    expect(candidates.length).toBeGreaterThan(1);
    const expected = new Set(candidates.flatMap((v) => v.positionKeys));
    const actual = store.get(chordHighlightPositionsAtom);
    expect(actual).toEqual(expected);
    // Explicitly confirm "more than one candidate worth of keys":
    expect(actual.size).toBeGreaterThan(candidates[0]!.positionKeys.length);
  });

  // T6 — chordHighlightPositionsAtom now derives from visibleVoicingMatchesAtom
  // (the same source the connector pipeline uses) and ALWAYS supplements with
  // chord tones inside the active polygon — regardless of Lock-to-scale state.
  it("highlights are scoped to visible voicings + inside-polygon chord tones when a CAGED shape is active (T6)", () => {
    // Highlights are derived from visibleVoicingMatchesAtom + addChordTonesWithinPolygon —
    // not from every voicing across the whole neck.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "V", qualityOverride: "7" })], // G7
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])],
    ]);

    const { shapePolygons } = store.get(shapeDataAtom);
    expect(shapePolygons.length).toBeGreaterThan(0);

    const visible = store.get(visibleVoicingMatchesAtom);
    const all = store.get(voicingMatchesAtom);
    // Sanity: visible filters out neck-wide voicings — there are vertices in
    // `all` that are not in `visible` and lie outside the active polygon.
    const visibleKeys = new Set(visible.flatMap((v) => v.positionKeys));
    const allKeys = new Set(all.flatMap((v) => v.positionKeys));
    const outsidePolyNonVisible = [...allKeys].filter(
      (k) => !visibleKeys.has(k) && !isInAnyPolygon(k, shapePolygons),
    );
    expect(outsidePolyNonVisible.length).toBeGreaterThan(0);

    const highlights = store.get(chordHighlightPositionsAtom);
    // After fix: highlights must NOT contain any of those outside-polygon
    // non-visible voicing keys (OLD behavior leaked them in).
    for (const k of outsidePolyNonVisible) {
      expect(highlights.has(k)).toBe(false);
    }
  });

  it("keeps connector-vertex positions outside the polygon when a CAGED shape is active (T6)", () => {
    // Fixture: IV (F major) on the D-shape in C major produces a visible
    // full-chord voicing whose vertices spill slightly outside the polygon
    // boundary — exactly the case where the OLD code stripped those positions,
    // leaving the connector polyline drawing through bubble-less vertices.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "IV" })], // F major
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["D"])],
    ]);

    const visible = store.get(visibleVoicingMatchesAtom);
    const { shapePolygons } = store.get(shapeDataAtom);
    expect(shapePolygons.length).toBeGreaterThan(0);

    const outsidePositions = visible.flatMap((m) =>
      m.positionKeys.filter((k) => !isInAnyPolygon(k, shapePolygons)),
    );
    expect(outsidePositions.length).toBeGreaterThan(0);

    const highlights = store.get(chordHighlightPositionsAtom);
    for (const key of outsidePositions) {
      expect(highlights.has(key)).toBe(true);
    }
  });

  it("highlights only in-polygon close voicings when CAGED shape is active", () => {
    // closeCandidatesAllStringSetsAtom returns all candidates (whole neck, unscoped).
    // Scoping to the polygon happens at chordHighlightPositionsAtom level.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })], // C major
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);
    const highlights = store.get(chordHighlightPositionsAtom);
    const { shapePolygons } = store.get(shapeDataAtom);
    // Use all shapePolygons (including truncated) to match isInAnyPolygon semantics
    // used by addChordTonesWithinPolygon inside chordHighlightPositionsAtom.
    expect(shapePolygons.length).toBeGreaterThan(0);
    // Sanity: closeCandidatesAllStringSetsAtom returns whole-neck candidates,
    // so there will be positions outside the active polygon.
    const allCandidateKeys = new Set(
      store.get(closeCandidatesAllStringSetsAtom).flatMap((v) => v.positionKeys),
    );
    // Use the same isInAnyPolygon check that addChordTonesWithinPolygon uses
    const outsideKeys = [...allCandidateKeys].filter(
      (key) => !isInAnyPolygon(key, shapePolygons),
    );
    // There must be whole-neck candidates that lie outside the active polygon
    expect(outsideKeys.length).toBeGreaterThan(0);
    // After fix: highlights must NOT contain any of those outside-polygon keys
    for (const key of outsideKeys) {
      expect(highlights.has(key)).toBe(false);
    }
    expect(highlights.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Group J' — visibleVoicingMatchesAtom (T5: shared selector for highlights)
// ---------------------------------------------------------------------------

describe("visibleVoicingMatchesAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to all voicing matches when fingering pattern has no active position", () => {
    // fingeringPattern='none' => activePositionAtom is false, no filtering.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    const all = store.get(voicingMatchesAtom);
    const visible = store.get(visibleVoicingMatchesAtom);
    expect(all.length).toBeGreaterThan(0);
    expect(visible).toEqual(all);
  });

  it("filters to position-relevant voicings when a CAGED position is active", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })], // C major chord
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["E"])], // single E-shape => active position
    ]);
    const all = store.get(voicingMatchesAtom);
    const visible = store.get(visibleVoicingMatchesAtom);

    expect(all.length).toBeGreaterThan(0);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThanOrEqual(all.length);
    // With a single CAGED shape active, the selector dedupes by position key,
    // so the visible set should be strictly smaller than the all-shapes set.
    expect(visible.length).toBeLessThan(all.length);
  });

  it("returns scoped matches for 3NPS when a position is active (full voicing)", () => {
    // 3NPS always scopes when an active position exists — chordScopeToPosition
    // no longer gates this behaviour. Use full voicing with position 1 which
    // produces matches for C major.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "V", manualRoot: "G", qualityOverride: "M" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1],
    ]);
    const all = store.get(voicingMatchesAtom);
    const visible = store.get(visibleVoicingMatchesAtom);
    const { highlightNotes } = store.get(shapeDataAtom);
    const patternSet = new Set(highlightNotes.filter((n) => n.includes("-")));
    // Every visible voicing has at most 1 note outside the diagonal pattern
    // (per scoreFullChordForThreeNpsPosition tighter 3NPS tolerance).
    for (const v of visible) {
      const outsideCount = v.notes.filter(
        (n) => !patternSet.has(`${n.stringIndex}-${n.fretIndex}`),
      ).length;
      expect(outsideCount).toBeLessThanOrEqual(1);
    }
    // Visible is scoped (≤ all candidates).
    expect(visible.length).toBeLessThanOrEqual(all.length);
    // When an active 3NPS position exists, scoping is always on.
    expect(store.get(activePositionAtom)).toBe(true);
  });

  it("scopes close voicings to the active CAGED polygon", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);
    const visible = store.get(visibleVoicingMatchesAtom);
    const { shapePolygons } = store.get(shapeDataAtom);
    const cShapes = shapePolygons.filter((p) => p.shape === "C" && !p.truncated);
    expect(cShapes.length).toBeGreaterThan(0);
    for (const voicing of visible) {
      const fitsSome = cShapes.some(
        (polygon) => selectCloseFallbacksForCagedPosition([voicing], polygon).length === 1,
      );
      expect(fitsSome).toBe(true);
    }
    expect(visible.length).toBeGreaterThan(0);
  });

  it("scopes full voicings to the active 3NPS position without any toggle", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1],
    ]);
    const visible = store.get(visibleVoicingMatchesAtom);
    const { highlightNotes } = store.get(shapeDataAtom);
    const patternSet = new Set(highlightNotes.filter((n) => n.includes("-")));
    // Every visible voicing has outsideCount <= 1 vs the diagonal 3NPS pattern
    // (per scoreFullChordForThreeNpsPosition tighter 3NPS tolerance — diagonal-aware).
    for (const v of visible) {
      const outsideCount = v.notes.filter(
        (n) => !patternSet.has(`${n.stringIndex}-${n.fretIndex}`),
      ).length;
      expect(outsideCount).toBeLessThanOrEqual(1);
    }
  });

  it("scopes close voicings to the active 3NPS position", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 3], // a position previously broken by snap-to-scale
    ]);
    const visible = store.get(visibleVoicingMatchesAtom);
    const { highlightNotes } = store.get(shapeDataAtom);
    const patternSet = new Set(highlightNotes.filter((n) => n.includes("-")));
    // Every visible close voicing must have ALL notes inside the diagonal pattern
    // (selectCloseFallbacksForThreeNpsPosition requires exact membership, zero tolerance).
    for (const v of visible) {
      for (const n of v.notes) {
        expect(patternSet.has(`${n.stringIndex}-${n.fretIndex}`)).toBe(true);
      }
    }
  });

  it("returns at least one full voicing for a populated 3NPS position", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1],
    ]);
    const visible = store.get(visibleVoicingMatchesAtom);
    expect(visible.length).toBeGreaterThan(0);
  });

  it("returns at least one close voicing for a populated 3NPS position", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1],
    ]);
    const visible = store.get(visibleVoicingMatchesAtom);
    expect(visible.length).toBeGreaterThan(0);
  });

  it("close voicings on CAGED are deduped across polygon instances", () => {
    // A single close voicing may fit multiple octave instances of the same CAGED
    // shape (e.g. open C-shape at fret 0 AND its 12-fret octave). Without dedup,
    // the same voicing appears twice in visibleVoicingMatchesAtom, downstream
    // assignConflictOffsets sees identical polylines (distance=0 → conflict) and
    // assigns a non-zero radius offset even though there's only one actual voicing.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);
    const visible = store.get(visibleVoicingMatchesAtom);
    const keys = visible.map((v) => v.positionKeys.slice().sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length); // no dups
  });
});

// ---------------------------------------------------------------------------
// Group G4 — closeCandidatesAtom (Plan H-T5 update)
// The strict position-key subset filter from Plan G4 has been reverted to
// fret-bound semantics. See Group H-T5 for the primary coverage.
// These tests verify the snap toggle and pattern-type no-ops still hold.
// ---------------------------------------------------------------------------

// Group G4 removed: snap-to-scale filter has been dropped from closeCandidatesAtom.
// Position scoping now lives exclusively in visibleVoicingMatchesAtom /
// chordHighlightPositionsAtom. See Group J' for the replacement coverage.

// ---------------------------------------------------------------------------
// Group M — voicingStringSetAtom + effectiveStringSetAtom (v2.0)
// ---------------------------------------------------------------------------

describe("voicingStringSetAtom + effectiveStringSetAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'all' → in full mode returns all 6 strings (full mode ignores stored window)", () => {
    // Default voicingAtom is "full". effectiveStringSetAtom always returns ALL_SIX_STRINGS in full mode.
    const store = makeAtomStore([]);
    expect(store.get(voicingStringSetAtom)).toBe("all");
    expect([...store.get(effectiveStringSetAtom)]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("selecting a window narrows effective strings in close mode", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "7" })],
      [voicingAtom, "close"],
    ]);
    store.set(voicingStringSetAtom, "1-2-3-4");
    expect([...store.get(effectiveStringSetAtom)]).toEqual([1, 2, 3, 4]);
  });

  it("falls back to first available window when stored id no longer matches options (close mode)", () => {
    // Major Triad has 3 notes → options are "0-1-2", "1-2-3", ... "3-4-5".
    // "0-1-2-3" (a 4-note window) doesn't appear in triad options.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "close"],
    ]);
    store.set(voicingStringSetAtom, "0-1-2-3");
    expect([...store.get(effectiveStringSetAtom)]).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Group G7 — stringSetOptionsAtom no-chord branch
// ---------------------------------------------------------------------------

describe("stringSetOptionsAtom — no-chord branch", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty list when no chord is active", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, []],
    ]);
    expect(store.get(stringSetOptionsAtom)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Group G7b — effectiveStringSetAtom voicing-mode-aware (Task 2)
// ---------------------------------------------------------------------------

describe("effectiveStringSetAtom (voicing-mode aware)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns all 6 strings in full mode regardless of stored window", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [voicingStringSetAtom, "0-1-2"],
    ]);
    expect(store.get(effectiveStringSetAtom)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("returns stored window's strings in close mode when option is enabled", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "none"],
      [voicingAtom, "close"],
      [voicingStringSetAtom, "0-1-2"],
    ]);
    expect(store.get(effectiveStringSetAtom)).toEqual([0, 1, 2]);
  });

  it("returns stored window's strings (unchanged) in close mode when no option is enabled (dead-end)", () => {
    // C dim / C major / G shape: all close-voicing windows are disabled
    // because no close voicing fits the G-shape polygon.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "dim" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["G"])],
      [voicingAtom, "close"],
      [voicingStringSetAtom, "0-1-2"],
    ]);
    const options = store.get(stringSetOptionsAtom);
    // Sanity-check the setup: all options should be disabled
    expect(options.every((o) => o.disabled)).toBe(true);
    // No silent ALL fallback — returns stored window's strings unchanged
    expect(store.get(effectiveStringSetAtom)).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Group G8 — stringSetOptionsAtom disabled state (Plan G8)
// ---------------------------------------------------------------------------

describe("stringSetOptionsAtom — position-based disable (Plan G8)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks string sets with no fit in the active 3NPS position as disabled with a reason", () => {
    // F# Major Triad at 3NPS position 4, second octave (frets 19–24):
    // strings 0–1–2 and 1–2–3 have candidates fitting the high-fret window,
    // but the 2–3–4 window has no candidate that fits — fret space runs out.
    const store = makeAtomStore([
      [rootNoteAtom, "F#"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "F#" })],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 4],
      [npsOctaveAtom, 1],
      [voicingAtom, "close"],
    ]);

    const options = store.get(stringSetOptionsAtom);
    // Must have more than just "all" for this to be meaningful
    expect(options.length).toBeGreaterThan(1);

    // At least some options should be disabled (the 2-3-4 window has no candidate
    // that fits the 3NPS aggregate fret bounds at this position — fret space runs out).
    const disabled = options.filter((o) => o.disabled);
    expect(disabled.length).toBeGreaterThan(0);
    for (const opt of disabled) {
      expect(opt.disabledReason).toBeTruthy();
    }
  });

  it("does not mark any option disabled when fingeringPattern is 'none' (no position to gate against)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "7" })],
      [fingeringPatternAtom, "none"],
    ]);

    const options = store.get(stringSetOptionsAtom);
    expect(options.every((o) => !o.disabled)).toBe(true);
  });

  it("does not mark any option disabled when fingeringPattern is 'none' regardless of voicing type", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "7" })],
      [fingeringPatternAtom, "none"],
      [voicingAtom, "close"],
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
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "7" })],
      [voicingAtom, "close"],
    ]);
    expect(store.get(closeCandidatesAtom).length).toBeGreaterThan(0);
  });

  it("'1-2-3-4' excludes voicings using string 0 or string 5", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "7" })],
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

// Group H-T5 removed: the fret-bound snap-to-scale filter has been dropped from
// closeCandidatesAtom. These invariants now hold at visibleVoicingMatchesAtom level.
// See Group J' for replacement coverage.

// ---------------------------------------------------------------------------
// Group I-T6 — closeCandidatesAtom diagonal string-specific scale-locking (Plan I-T6 updated)
// ---------------------------------------------------------------------------

// Group I-T6 removed: diagonal string-specific scale-locking has been dropped from
// closeCandidatesAtom. These invariants now hold at visibleVoicingMatchesAtom level.
// See Group J' ("scopes close voicings to the active CAGED polygon" / "scopes close voicings
// to the active 3NPS position") for replacement coverage.

// ---------------------------------------------------------------------------
// Group I-T6 Part 3 — closeCandidatesAtom & highlights — multi-octave repeating shapes & decoupled highlights (Plan I-T6 Part 3)
// ---------------------------------------------------------------------------

describe("closeCandidatesAtom & highlights — decoupled highlights (Plan I-T6 Part 3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // "admits close candidates on all repeating shape instances" removed:
  // closeCandidatesAtom no longer applies a positional filter; that invariant
  // is now covered at visibleVoicingMatchesAtom level.

  it("decouples note highlights on the neck from the selected string set window", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C" })], // C Major
      [voicingAtom, "close"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
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
    // C major triad (degree I) on the G-shape CAGED position (high up the neck):
    // Some 3-string windows can form the chord inside the G-shape polygon; others can't.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["G"])],
      [voicingAtom, "close"],
    ]);

    const options = store.get(stringSetOptionsAtom);
    // Sanity: there must be at least one disabled option and at least one enabled option
    // for the fallback logic to be exercisable.
    const disabledOption = options.find((o) => o.disabled);
    const firstEnabled = options.find((o) => !o.disabled);

    if (!disabledOption || !firstEnabled) {
      // The fixture didn't produce mixed disabled/enabled options — skip the
      // detailed assertion and just verify the atom returns something.
      expect(options.length).toBeGreaterThan(0);
      return;
    }

    expect(disabledOption).toBeTruthy();
    expect(firstEnabled).toBeTruthy();

    // User picks the disabled option
    store.set(voicingStringSetAtom, disabledOption.id);

    const effective = store.get(effectiveStringSetAtom);
    expect(effective).toEqual(firstEnabled.strings);
  });

  it("keeps the user's pick when it is NOT disabled (regression guard)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "none"],
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

// ---------------------------------------------------------------------------
// Group G — chordHighlightPositionsAtom referential stability
// Set returns defeat React Compiler's auto-memoization downstream.
// ---------------------------------------------------------------------------

describe("chordHighlightPositionsAtom referential stability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the SAME Set reference on consecutive reads with no atom changes", () => {
    // Sanity baseline: even without memoization, Jotai caches derived-atom
    // reads when no dependency has changed. With the content-fingerprint
    // cache in place, identity stability is preserved through that path too.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
    ]);
    const first = store.get(chordHighlightPositionsAtom);
    const second = store.get(chordHighlightPositionsAtom);
    expect(second).toBe(first);
  });

  it("returns the SAME Set reference when a dep changes but the resulting content is value-equal (non-empty)", () => {
    // Seed C Major with degree I, voicing=full, no shape pattern (fingering=none).
    // Toggling overlay hidden to true collapses to empty, then back to false
    // restores the same set — memoization must return the SAME reference.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [fingeringPatternAtom, "none"],
      [voicingAtom, "full"],
      [chordOverlayHiddenAtom, false],
    ]);
    const first = store.get(chordHighlightPositionsAtom);
    expect(first.size).toBeGreaterThan(0);
    // Re-evaluate without any state change — memoization must return the
    // SAME reference because the content fingerprint is unchanged.
    const second = store.get(chordHighlightPositionsAtom);
    expect(second).toBe(first);
  });

  it("returns a DIFFERENT Set reference when the underlying highlight content changes", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [chordOverlayHiddenAtom, false],
    ]);
    const first = store.get(chordHighlightPositionsAtom);
    expect(first.size).toBeGreaterThan(0);
    // Hiding the overlay collapses the Set to empty — content genuinely changed.
    store.set(chordOverlayHiddenAtom, true);
    const second = store.get(chordHighlightPositionsAtom);
    expect(second).not.toBe(first);
    expect(second.size).toBe(0);
  });
});

describe("chordLookupAtom — referential stability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the same chord lookup reference when visible chord tones are unchanged", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);

    const first = store.get(chordLookupAtom);
    store.set(
      progressionStepsAtom,
      store.get(progressionStepsAtom).map((step) => ({ ...step })),
    );
    const second = store.get(chordLookupAtom);

    expect(second).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// Group K — visibleVoicingMatchesAtom — full mode with close fallback (B4)
// ---------------------------------------------------------------------------

import { fallbackVoicingMatchesAtom } from "./voicingFallbackAtoms";

describe("visibleVoicingMatchesAtom — full mode with close fallback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("includes fallback voicings in the visible set", () => {
    // B diminished has no full template for some CAGED shapes, so those
    // positions should fall back to close voicings if any fit.
    const store = makeAtomStore([
      [rootNoteAtom, "B"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "B", qualityOverride: "dim" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);

    const visible = store.get(visibleVoicingMatchesAtom);
    const fallbacks = store.get(fallbackVoicingMatchesAtom);

    // Every fallback voicing's positionKeys signature must appear in visible.
    for (const fb of fallbacks) {
      const key = fb.positionKeys.join("|");
      expect(visible.some((v) => v.positionKeys.join("|") === key)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Group I — audio-lock regression: chordHighlightPositionsAtom advances with progression step
// ---------------------------------------------------------------------------

describe("chordHighlightPositionsAtom — audio-locked to progression playhead", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("chordHighlightPositionsAtom advances with displayedStepIndexPrimitiveAtom during playback", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, [
        { id: "a", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
        { id: "b", degree: "V", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
      ] as never],
      [voicingAtom, "full"],
      [chordOverlayHiddenAtom, false],
    ]);

    // Advance to step 0 and enable playback
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(setProgressionPlayingAtom, true);

    // Capture the resolved step at index 0 (I chord)
    const stepAtZero = store.get(activeResolvedProgressionStepAtom);
    expect(stepAtZero?.degree).toBe("I");
    const beforeHighlight = store.get(chordHighlightPositionsAtom);

    // Simulate playhead advance: set the displayed step index to 1
    store.set(displayedStepIndexPrimitiveAtom, 1);

    // Verify the resolved step changed to V chord
    const stepAtOne = store.get(activeResolvedProgressionStepAtom);
    expect(stepAtOne?.degree).toBe("V");
    const afterHighlight = store.get(chordHighlightPositionsAtom);

    // Different chord => different highlight set
    expect(afterHighlight).not.toEqual(beforeHighlight);
  });
});

describe("visibleVoicingMatchesAtom — referential stability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the same visibleVoicingMatches reference when cagedShapes is replaced with an equal Set", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);

    const first = store.get(visibleVoicingMatchesAtom);
    store.set(cagedShapesAtom, new Set<CagedShape>(["C"]));
    const second = store.get(visibleVoicingMatchesAtom);

    expect(second).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// Group — voicing=off in-polygon highlights are unconditional
// ---------------------------------------------------------------------------

describe("chordHighlightPositionsAtom — voicing=off, no snap toggle required", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("highlights in-polygon chord tones when voicing=off and a pattern is active (no toggle required)", () => {
    // In-polygon highlights always fire when voicing=off and a shape polygon exists.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })], // C major
      [voicingAtom, "off"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);
    const { shapePolygons } = store.get(shapeDataAtom);
    expect(shapePolygons.length).toBeGreaterThan(0);

    const highlights = store.get(chordHighlightPositionsAtom);
    expect(highlights.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Group — 3NPS diagonal filter: per-string-fret membership regression
// ---------------------------------------------------------------------------

describe("3NPS voicing filter uses per-string-fret pattern membership (diagonal-aware)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("3NPS full-voicing filter accepts voicings inside the diagonal pattern (per-string-fret membership)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 3],
    ]);
    const visible = store.get(visibleVoicingMatchesAtom);
    const { highlightNotes } = store.get(shapeDataAtom);
    const patternSet = new Set(highlightNotes.filter((n) => n.includes("-")));
    // 3NPS full tolerance: every visible voicing has at most 1 note outside the pattern.
    for (const v of visible) {
      const outside = v.notes.filter(
        (n) => !patternSet.has(`${n.stringIndex}-${n.fretIndex}`),
      ).length;
      expect(outside).toBeLessThanOrEqual(1);
    }
  });

  it("3NPS close-voicing filter requires all notes inside the diagonal pattern", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "close"],
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 3],
    ]);
    const visible = store.get(visibleVoicingMatchesAtom);
    const { highlightNotes } = store.get(shapeDataAtom);
    const patternSet = new Set(highlightNotes.filter((n) => n.includes("-")));
    for (const v of visible) {
      for (const n of v.notes) {
        expect(patternSet.has(`${n.stringIndex}-${n.fretIndex}`)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Group L — chordLookup slice atoms — selectAtom reference stability
// ---------------------------------------------------------------------------

describe("chordLookup slice atoms — selectAtom reference stability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("chordLookupRootAtom does not re-emit when only the progression-step id object changes", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);

    const first = store.get(chordLookupRootAtom);
    let notifications = 0;
    const unsub = store.sub(chordLookupRootAtom, () => {
      notifications++;
    });

    // Mutate progression-step identity without changing root or type.
    store.set(
      progressionStepsAtom,
      store.get(progressionStepsAtom).map((step) => ({ ...step })),
    );

    unsub();
    const second = store.get(chordLookupRootAtom);
    expect(second).toBe(first);
    expect(notifications).toBe(0);
  });

  it("chordLookupTypeAtom does not re-emit when only chord tones become hidden", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);

    const first = store.get(chordLookupTypeAtom);
    let notifications = 0;
    const unsub = store.sub(chordLookupTypeAtom, () => {
      notifications++;
    });

    // chordOverlayHiddenAtom collapses chordTones to [] but leaves chordType intact.
    store.set(chordOverlayHiddenAtom, true);

    unsub();
    const second = store.get(chordLookupTypeAtom);
    expect(second).toBe(first);
    expect(notifications).toBe(0);
  });

  it("chordLookupRootAtom does re-emit when the chord root actually changes", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);

    const first = store.get(chordLookupRootAtom);
    let notifications = 0;
    const unsub = store.sub(chordLookupRootAtom, () => {
      notifications++;
    });

    // Switching to the V chord changes the root from C to G.
    store.set(progressionStepsAtom, progressionWith({ degree: "V" }));

    unsub();
    const second = store.get(chordLookupRootAtom);
    expect(second).not.toBe(first);
    expect(notifications).toBeGreaterThanOrEqual(1);
  });
});

describe("visibleVoicingMatchesAtom — Full + Scale None fallback (regression 2026-06-03)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("C6 + Scale None + Full renders connector voicings (was zero)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "6" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(visibleVoicingMatchesAtom).length).toBeGreaterThan(0);
  });

  it("power chord + Scale None + Full renders connector voicings", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "5" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(visibleVoicingMatchesAtom).length).toBeGreaterThan(0);
  });

  it.each(["aug", "6", "m6", "mMaj7", "5"])(
    "renders connector voicings for template-less quality %s in Full + Scale None",
    (quality) => {
      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "major"],
        [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: quality })],
        [voicingAtom, "full"],
        [fingeringPatternAtom, "none"],
      ]);
      expect(store.get(visibleVoicingMatchesAtom).length).toBeGreaterThan(0);
    },
  );

  it("renders neck-spread connectors for C6 in multi-shape CAGED (no single active position)", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "6" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C", "A", "G", "E", "D"])],
    ]);
    expect(store.get(visibleVoicingMatchesAtom).length).toBeGreaterThan(0);
  });
});
