import React from "react";
import { describe, expect, it } from "vitest";
import { Provider, createStore } from "jotai";
import { renderHook } from "@testing-library/react";
import { setProgressionPlayingAtom } from "../../../store/progressionAtoms";
import { useFretboardPlaybackSnapshot } from "./useFretboardPlaybackSnapshot";

function makeWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children);
}

describe("useFretboardPlaybackSnapshot", () => {
  it("returns { playing: true } when playback is active", () => {
    const store = createStore();
    store.set(setProgressionPlayingAtom, true);
    
    const { result } = renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toEqual({ playing: true });
  });

  it("returns null when enabled=false", () => {
    const store = createStore();
    store.set(setProgressionPlayingAtom, true);
    
    const { result } = renderHook(() => useFretboardPlaybackSnapshot(false), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toBeNull();
  });

  it("returns null when not playing", () => {
    const store = createStore();
    // Default is false
    const { result } = renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toBeNull();
  });
});
