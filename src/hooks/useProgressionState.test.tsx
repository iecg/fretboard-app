// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { progressionChordPatternAtom, progressionGenreStyleAtom } from "../store/progressionAtoms";
import { useProgressionState } from "./useProgressionState";

function makeWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

describe("useProgressionState — individual setters revert genre to custom", () => {
  it("reverts genre style to 'custom' when an individual pattern setting changes", () => {
    const store = createStore();
    store.set(progressionGenreStyleAtom, "rock");

    const { result } = renderHook(() => useProgressionState(), {
      wrapper: makeWrapper(store),
    });

    expect(store.get(progressionGenreStyleAtom)).toBe("rock");

    act(() => {
      result.current.setProgressionChordPattern("offbeat-skank");
    });

    expect(store.get(progressionChordPatternAtom)).toBe("offbeat-skank");
    expect(store.get(progressionGenreStyleAtom)).toBe("custom");
  });

  it("reverts genre style to 'custom' when swing changes", () => {
    const store = createStore();
    store.set(progressionGenreStyleAtom, "jazz");

    const { result } = renderHook(() => useProgressionState(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.setProgressionSwing(0.5);
    });

    expect(store.get(progressionGenreStyleAtom)).toBe("custom");
  });

  it("applyGenreStyle does NOT revert to custom", () => {
    const store = createStore();

    const { result } = renderHook(() => useProgressionState(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.applyGenreStyle("rock");
    });

    expect(store.get(progressionGenreStyleAtom)).toBe("rock");
  });
});
