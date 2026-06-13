import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import { voicingAtom, voicingStringSetAtom } from "./chordOverlayAtoms";
import { cagedShapesAtom, fingeringPatternAtom } from "./fingeringAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { progressionStepsAtom } from "./progressionAtoms";
import {
  fallbackPolygonsAtom,
  fallbackVoicingMatchesAtom,
  hasFallbackPositionsAtom,
} from "./voicingFallbackAtoms";
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

describe("fallbackVoicingMatchesAtom", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("returns empty when voicing mode is 'close'", () => {
    store.set(voicingAtom, "close");
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });

  it("returns empty when voicing mode is 'off'", () => {
    store.set(voicingAtom, "off");
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });

  it("returns empty in 'none' pattern when the active chord has a full template", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });
});

describe("hasFallbackPositionsAtom", () => {
  it("is false when fallback list is empty", () => {
    const store = createStore();
    store.set(voicingAtom, "close");
    expect(store.get(hasFallbackPositionsAtom)).toBe(false);
  });

  it("derives from fallbackPolygonsAtom, not the string-set-filtered list", () => {
    // Architectural invariant: picker visibility (hasFallbackPositionsAtom)
    // must NOT depend on the user's voicingStringSetAtom selection. Otherwise
    // picking a string set that yields zero in-polygon fits causes the picker
    // to unmount and the user is stuck (see systematic-debugging session
    // 2026-05-26: B7 / C major / Caged).
    const store = createStore();
    store.set(voicingAtom, "full");
    store.set(fingeringPatternAtom, "caged");

    const polygonsBefore = store.get(fallbackPolygonsAtom);
    const hasBefore = store.get(hasFallbackPositionsAtom);

    // Change the user's string-set pick to something different.
    store.set(voicingStringSetAtom, "top-4");
    const polygonsAfter = store.get(fallbackPolygonsAtom);
    const hasAfter = store.get(hasFallbackPositionsAtom);

    // fallbackPolygonsAtom does not depend on voicingStringSetAtom -> same ref.
    expect(polygonsAfter).toBe(polygonsBefore);
    expect(hasAfter).toBe(hasBefore);
  });
});

describe("fallbackVoicingMatchesAtom — full-mode string-set bypass (Task 3 regression-guard)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("emits identical matches in full mode regardless of voicingStringSetAtom value", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["D"])],
      [voicingAtom, "full"],
    ]);

    store.set(voicingStringSetAtom, "0-1-2");
    const matchesA = store.get(fallbackVoicingMatchesAtom);

    store.set(voicingStringSetAtom, "2-3-4");
    const matchesB = store.get(fallbackVoicingMatchesAtom);

    expect(matchesA).toEqual(matchesB);
  });
});

describe("fallbackVoicingMatchesAtom — one grip per polygon (Phase 1)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("emits exactly one fallback grip per qualifying polygon (collapses multiple fits)", () => {
    // C6 has no full-chord template, and the C-shape window fits 3 close grips
    // per polygon (2 polygons). Pre-fix this rendered 6 overlapping grips;
    // the de-clutter must collapse to one grip per polygon.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "6" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);
    const polys = store.get(fallbackPolygonsAtom);
    const matches = store.get(fallbackVoicingMatchesAtom);
    expect(polys.length).toBeGreaterThan(1);
    expect(matches.length).toBe(polys.length);
  });
});

describe("fallbackVoicingMatchesAtom — referential stability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the same fallbackVoicingMatches reference when the active shape set is value-equal", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "B"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "B", qualityOverride: "dim" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["C"])],
    ]);

    const first = store.get(fallbackVoicingMatchesAtom);
    store.set(cagedShapesAtom, new Set<CagedShape>(["C"]));
    const second = store.get(fallbackVoicingMatchesAtom);

    expect(second).toBe(first);
  });
});

describe("fallbackVoicingMatchesAtom — neck spread in Scale None (Phase 2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a non-empty fallback spread for a no-template chord (C6) in Scale None", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "6" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    const matches = store.get(fallbackVoicingMatchesAtom);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.isFallback === true)).toBe(true);
  });

  it("returns a non-empty spread for a power chord in Scale None", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "5" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(fallbackVoicingMatchesAtom).length).toBeGreaterThan(0);
  });

  it("stays empty for a CAGED-able chord (C major) in Scale None — a full template exists", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I", manualRoot: "C", qualityOverride: "M" })],
      [voicingAtom, "full"],
      [fingeringPatternAtom, "none"],
    ]);
    expect(store.get(fallbackVoicingMatchesAtom)).toEqual([]);
  });
});
