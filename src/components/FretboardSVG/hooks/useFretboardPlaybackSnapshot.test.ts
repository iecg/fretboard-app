import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Provider, createStore } from "jotai";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  setProgressionPlayingAtom,
  progressionStepsAtom,
  beatsPerBarAtom,
  displayedStepIndexPrimitiveAtom,
} from "../../../store/progressionAtoms";
import { progressionVisualFrameAtom } from "../../../store/progressionVisualAtoms";
import { useFretboardPlaybackSnapshot } from "./useFretboardPlaybackSnapshot";
import * as timeline from "../../../progressions/audio/timeline";

describe("useFretboardPlaybackSnapshot", () => {
  let rafCb: FrameRequestCallback | null = null;
  let rafId = 0;

  beforeEach(() => {
    rafCb = null;
    rafId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCb = cb;
      return ++rafId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      if (id === rafId) rafCb = null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function tick() {
    rafCb?.(performance.now());
  }

  function makePlayingStore() {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(beatsPerBarAtom, 4);
    store.set(setProgressionPlayingAtom, true);
    return store;
  }

  function makeWrapper(store: ReturnType<typeof createStore>) {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children);
  }

  it("returns null and clears atom when playback is not active", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });
    expect(store.get(progressionVisualFrameAtom)).toBeNull();
  });

  it("returns null and clears atom when enabled=false", () => {
    const store = makePlayingStore();
    renderHook(() => useFretboardPlaybackSnapshot(false), {
      wrapper: makeWrapper(store),
    });
    expect(store.get(progressionVisualFrameAtom)).toBeNull();
  });

  it("polls getTimelinePosition and writes to atoms each rAF tick", () => {
    const store = makePlayingStore();
    const frame = {
      stepIndex: 0,
      globalFraction: 0.125,
      localFraction: 0.75,
      paused: false,
    };
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue(frame);

    renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    act(() => { tick(); });

    expect(store.get(progressionVisualFrameAtom)).toEqual(frame);
  });

  it("writes displayedStepIndexPrimitiveAtom on step changes", () => {
    const store = makePlayingStore();
    const frames = [
      { stepIndex: 0, globalFraction: 0, localFraction: 0, paused: false },
      { stepIndex: 0, globalFraction: 0.5, localFraction: 0.5, paused: false },
      { stepIndex: 1, globalFraction: 0.6, localFraction: 0, paused: false },
    ];
    let i = 0;
    vi.spyOn(timeline, "getTimelinePosition").mockImplementation(
      () => frames[Math.min(i, frames.length - 1)],
    );

    renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    act(() => { tick(); });
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(0);
    act(() => { i++; tick(); });
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(0);
    act(() => { i++; tick(); });
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(1);
  });

  it("updates snapshot each frame via the hook return value", async () => {
    const store = makePlayingStore();
    const frame = {
      stepIndex: 0,
      globalFraction: 0.25,
      localFraction: 0.5,
      paused: false,
    };
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue(frame);

    const { result } = renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    act(() => { tick(); });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        playing: true,
        activeStepIndex: 0,
        globalFraction: 0.25,
        localFraction: 0.5,
        stepDurationBeats: 4,
      });
    });
  });

  it("clears progressionVisualFrameAtom and stops rAF when playing stops", () => {
    const store = makePlayingStore();
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
      stepIndex: 0, globalFraction: 0.1, localFraction: 0.1, paused: false,
    });

    renderHook(
      (p: { enabled: boolean }) =>
        useFretboardPlaybackSnapshot(p.enabled),
      { initialProps: { enabled: true }, wrapper: makeWrapper(store) },
    );

    act(() => { tick(); });
    expect(store.get(progressionVisualFrameAtom)).not.toBeNull();

    act(() => { store.set(setProgressionPlayingAtom, false); });
    // Store change triggers re-render; effect cleanup clears the atom
    expect(store.get(progressionVisualFrameAtom)).toBeNull();
  });
});
