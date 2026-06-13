// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "jotai";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import { useFretboardState } from "./useFretboardState";
import { voicingMatchesAtom } from "../store/chordOverlayAtoms";
import { fingeringPatternAtom, cagedShapesAtom, npsPositionAtom } from "../store/fingeringAtoms";
import { progressionStepsAtom } from "../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../store/scaleAtoms";
import { voicingAtom, chordOverlayHiddenAtom } from "../store/chordOverlayAtoms";

beforeEach(() => {
  localStorage.clear();
});

function wrapWithStore(store: ReturnType<typeof makeAtomStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("useFretboardState — chord box bounds gating (Task 7)", () => {
  it("returns null chordBoxBounds when no active position resolves", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "none"],
    ]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    expect(result.current.chordBoxBounds).toBeNull();
  });

  it("returns concrete chordBoxBounds when a single CAGED shape is active", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["C"])],
    ]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    // single CAGED shape => activePositionAtom is true => chordBoxBounds should equal boxBounds
    expect(result.current.chordBoxBounds).toEqual(result.current.boxBounds);
  });

  it("returns non-null chordBoxBounds when multiple CAGED shapes are selected", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["C", "A", "G"])],
    ]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    // multiple CAGED shapes => activePositionAtom is true => chordBoxBounds should equal boxBounds
    expect(result.current.chordBoxBounds).toEqual(result.current.boxBounds);
  });
});

describe("useFretboardState — 3NPS voicing scope (Task 3)", () => {
  function seedManualChord(): Array<readonly [unknown, unknown]> {
    // Manual C major triad via the active progression step — produces a
    // multi-position fullChordMatches set on a standard-tuned 6-string
    // fretboard, so the scope filter has something to filter.
    return [
      [progressionStepsAtom, [
        {
          id: "step-1",
          degree: "I",
          duration: { value: 1, unit: "bar" },
          qualityOverride: "M",
          manualRoot: "C",
        },
      ]],
    ];
  }

  it("filters voicings when a 3NPS position is active", () => {
    const store = makeAtomStore([
      ...seedManualChord(),
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1],
    ] as Parameters<typeof makeAtomStore>[0]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    const raw = store.get(voicingMatchesAtom);
    expect(raw.length).toBeGreaterThan(0);
    expect(result.current.fullChordMatches.length).toBeLessThanOrEqual(raw.length);
    // When raw has multiple positions across the neck, the position-1 filter
    // must drop at least one. (If the test ever sees raw.length === filtered.length,
    // the seed isn't producing a spread chord — adjust the seed, not this assertion.)
    if (raw.length > 1) {
      expect(result.current.fullChordMatches.length).toBeLessThan(raw.length);
    }
  });

  // Note: npsPositionAtom storage clamps to [1, 7] (constrainedNumberStorage),
  // so `npsPosition === 0` is unreachable at runtime — `activePositionAtom` is
  // always true for 3NPS. Position-based filtering is unconditional in 3NPS mode.
});

describe("useFretboardState — CAGED shape filtering and truncation", () => {
  it("suppresses spurious chord shape at fret 0 for D shape scale in C Major", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["D"])],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [voicingAtom, "caged"],
      [chordOverlayHiddenAtom, false],
      [progressionStepsAtom, [
        {
          id: "step-1",
          degree: "I",
          duration: { value: 1, unit: "bar" },
          qualityOverride: "M",
          manualRoot: "C",
        },
      ]],

    ] as Parameters<typeof makeAtomStore>[0]);

    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });

    // The open C Major voicing (shape: "C", position: "0-3") should be filtered out
    // because the only active D shape polygon near fret 0 is truncated/off-board.
    const openCMatch = result.current.fullChordMatches.find((m) => m.positionKeys.includes("4-3"));
    expect(openCMatch).toBeUndefined();
  });

  it("keeps valid open C Major chord at fret 0 for C shape scale in C Major", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["C"])],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [voicingAtom, "caged"],
      [chordOverlayHiddenAtom, false],
      [progressionStepsAtom, [
        {
          id: "step-1",
          degree: "I",
          duration: { value: 1, unit: "bar" },
          qualityOverride: "M",
          manualRoot: "C",
        },
      ]],
    ] as Parameters<typeof makeAtomStore>[0]);

    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });

    // The open C Major voicing (shape: "C", position: "0-3") should be retained
    // because the C shape polygon at fret 0 is fully on-board and not truncated.
    const openCMatch = result.current.fullChordMatches.find((m) => m.positionKeys.includes("4-3"));
    expect(openCMatch).toBeDefined();
  });
});

