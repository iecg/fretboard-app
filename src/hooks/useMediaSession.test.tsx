// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { createStore, Provider } from "jotai";
import { useMediaSession } from "./useMediaSession";
import {
  progressionPlayingAtom,
  activeProgressionStepIndexAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";

function makeWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

vi.stubGlobal(
  "MediaMetadata",
  class MediaMetadata {
    title: string;
    artist: string;
    album: string;
    constructor(init: { title: string; artist: string; album: string }) {
      this.title = init.title;
      this.artist = init.artist;
      this.album = init.album;
    }
  },
);

const originalMediaSession = navigator.mediaSession;

describe("useMediaSession", () => {
  let store: ReturnType<typeof createStore>;
  let handlers: Record<string, () => void>;

  beforeEach(() => {
    store = createStore();
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 0);

    handlers = {};
    Object.defineProperty(navigator, "mediaSession", {
      value: {
        setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
          handlers[action] = handler ?? (() => {});
        }),
        metadata: null,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaSession", {
      value: originalMediaSession,
      configurable: true,
      writable: true,
    });
  });

  it("sets metadata on mount", () => {
    renderHook(() => useMediaSession(), { wrapper: makeWrapper(store) });
    expect(navigator.mediaSession?.metadata).toBeInstanceOf(MediaMetadata);
  });

  it('play handler calls setProgressionPlaying(true)', () => {
    renderHook(() => useMediaSession(), { wrapper: makeWrapper(store) });
    act(() => { handlers.play(); });
    expect(store.get(progressionPlayingAtom)).toBe(true);
  });

  it('pause handler calls setProgressionPlaying(false)', () => {
    store.set(setProgressionPlayingAtom, true);
    renderHook(() => useMediaSession(), { wrapper: makeWrapper(store) });
    act(() => { handlers.pause(); });
    expect(store.get(progressionPlayingAtom)).toBe(false);
  });

  it('stop handler calls stopProgressionPlayback', () => {
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 2);
    renderHook(() => useMediaSession(), { wrapper: makeWrapper(store) });
    act(() => { handlers.stop(); });
    expect(store.get(progressionPlayingAtom)).toBe(false);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it('nexttrack advances step when not playing', () => {
    store.set(activeProgressionStepIndexAtom, 0);
    renderHook(() => useMediaSession(), { wrapper: makeWrapper(store) });
    act(() => { handlers.nexttrack(); });
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });

  it('nexttrack does nothing when playing', () => {
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 0);
    renderHook(() => useMediaSession(), { wrapper: makeWrapper(store) });
    act(() => { handlers.nexttrack(); });
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it('previoustrack goes to previous step when not playing', () => {
    store.set(activeProgressionStepIndexAtom, 2);
    renderHook(() => useMediaSession(), { wrapper: makeWrapper(store) });
    act(() => { handlers.previoustrack(); });
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });

  it('previoustrack does nothing when playing', () => {
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 2);
    renderHook(() => useMediaSession(), { wrapper: makeWrapper(store) });
    act(() => { handlers.previoustrack(); });
    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
  });

  it("clears handlers on unmount", () => {
    const { unmount } = renderHook(() => useMediaSession(), {
      wrapper: makeWrapper(store),
    });
    // The cleanup sets each handler to null
    unmount();
    const actionNames = ["play", "pause", "stop", "previoustrack", "nexttrack"];
    for (const action of actionNames) {
      expect(
        (navigator.mediaSession as NonNullable<typeof navigator.mediaSession>).setActionHandler,
      ).toHaveBeenCalledWith(action, null);
    }
  });
});
