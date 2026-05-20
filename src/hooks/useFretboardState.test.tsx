// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "jotai";
import { makeAtomStore } from "../test-utils/renderWithAtoms";
import { useFretboardState } from "./useFretboardState";
import {
  chordScopeToPositionAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
} from "../store/atoms";

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
