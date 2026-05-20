// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "jotai";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import { useFretboardState } from "./useFretboardState";
import { chordOverlayModeAtom, chordRootOverrideAtom, chordQualityOverrideAtom, fullChordMatchesAtom } from "../store/chordOverlayAtoms";
import { chordScopeToPositionAtom } from "../store/chordScope";
import { fingeringPatternAtom, cagedShapesAtom, npsPositionAtom } from "../store/fingeringAtoms";

function wrapWithStore(store: ReturnType<typeof makeAtomStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("useFretboardState — chord box bounds gating (Task 7)", () => {
  it("returns null chordBoxBounds when chordScopeToPositionAtom is off", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["C"])],
      [chordScopeToPositionAtom, false],
    ]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    expect(result.current.chordBoxBounds).toBeNull();
  });

  it("returns concrete chordBoxBounds when scope is on AND a single CAGED shape is active", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["C"])],
      [chordScopeToPositionAtom, true],
    ]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    // single CAGED shape => activePositionAtom is true
    // chordScopeToPosition is true => chordBoxBounds should equal boxBounds
    expect(result.current.chordBoxBounds).toEqual(result.current.boxBounds);
  });

  it("returns null chordBoxBounds when scope is on but no active position (multi CAGED)", () => {
    const store = makeAtomStore([
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["C", "A", "G"])],
      [chordScopeToPositionAtom, true],
    ]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    // multiple CAGED shapes => activePositionAtom is false => chordBoxBounds null
    expect(result.current.chordBoxBounds).toBeNull();
  });
});

describe("useFretboardState — 3NPS voicing scope (Task 3)", () => {
  function seedManualChord(): Array<readonly [unknown, unknown]> {
    // Manual C major triad — produces a multi-position fullChordMatches set
    // on a standard-tuned 6-string fretboard, so the scope filter has
    // something to filter.
    return [
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
      [chordQualityOverrideAtom, "major"],
    ];
  }

  it("filters voicings when scope is on and a 3NPS position is active", () => {
    const store = makeAtomStore([
      ...seedManualChord(),
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1],
      [chordScopeToPositionAtom, true],
    ] as Parameters<typeof makeAtomStore>[0]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    const raw = store.get(fullChordMatchesAtom);
    expect(raw.length).toBeGreaterThan(0);
    expect(result.current.fullChordMatches.length).toBeLessThanOrEqual(raw.length);
    // When raw has multiple positions across the neck, the position-1 filter
    // must drop at least one. (If the test ever sees raw.length === filtered.length,
    // the seed isn't producing a spread chord — adjust the seed, not this assertion.)
    if (raw.length > 1) {
      expect(result.current.fullChordMatches.length).toBeLessThan(raw.length);
    }
  });

  it("does not filter when scope is off", () => {
    const store = makeAtomStore([
      ...seedManualChord(),
      [fingeringPatternAtom, "3nps"],
      [npsPositionAtom, 1],
      [chordScopeToPositionAtom, false],
    ] as Parameters<typeof makeAtomStore>[0]);
    const { result } = renderHook(() => useFretboardState(), {
      wrapper: wrapWithStore(store),
    });
    const raw = store.get(fullChordMatchesAtom);
    expect(result.current.fullChordMatches).toEqual(raw);
  });

  // Note: npsPositionAtom storage clamps to [1, 7] (constrainedNumberStorage),
  // so `npsPosition === 0` is unreachable at runtime — `activePositionAtom` is
  // always true for 3NPS. The scope toggle is the only way to bypass filtering
  // in 3NPS mode (covered by the "scope off" case above).
});
