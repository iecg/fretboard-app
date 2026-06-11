// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { progressionChordPatternAtom, progressionGenreStyleAtom, progressionSwingAtom } from "../store/progressionAtoms";
import { useProgressionState } from "./useProgressionState";

function makeWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

describe("useProgressionState — genre application", () => {
  it("applyGenreStyle sets the genre and its bundled pattern + swing", () => {
    const store = createStore();

    const { result } = renderHook(() => useProgressionState(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.applyGenreStyle("blues");
    });

    expect(store.get(progressionGenreStyleAtom)).toBe("blues");
    expect(store.get(progressionChordPatternAtom)).toBe("shuffle-comp");
    expect(store.get(progressionSwingAtom)).toBeCloseTo(0.33);
  });
});
