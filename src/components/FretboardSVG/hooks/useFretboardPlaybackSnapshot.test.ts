import React from "react";
import { describe, expect, it } from "vitest";
import { Provider, createStore } from "jotai";
import { renderHook, act } from "@testing-library/react";
import {
  setProgressionPlayingAtom,
  progressionStepsAtom,
  beatsPerBarAtom,
} from "../../../store/progressionAtoms";
import { progressionVisualFrameAtom } from "../../../store/progressionVisualAtoms";
import { useFretboardPlaybackSnapshot } from "./useFretboardPlaybackSnapshot";

/** Builds a store pre-seeded with a two-step I→V progression at bar 1 beat 4. */
function makePlayingStore() {
  const store = createStore();
  store.set(progressionStepsAtom, [
    { id: "i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  ]);
  store.set(beatsPerBarAtom, 4);
  store.set(setProgressionPlayingAtom, true);
  store.set(progressionVisualFrameAtom, {
    stepIndex: 0,
    globalFraction: 0.125,
    localFraction: 0.75,
    paused: false,
  });
  return store;
}

function makeWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children);
}

describe("useFretboardPlaybackSnapshot", () => {
  it("derives beat position and emphasis data from the mirrored playback frame", () => {
    const store = makePlayingStore();
    const { result } = renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toMatchObject({
      playing: true,
      activeStepIndex: 0,
      globalFraction: 0.125,
      localFraction: 0.75,
      stepDurationBeats: 4,
    });
    expect(result.current!.commonWithNext).toBeInstanceOf(Set);
    expect(result.current!.nextGuideTones).toBeInstanceOf(Set);
  });

  it("returns the correct common tones and guide tones for the default C-major I→V case", () => {
    // C major I = C major (C, E, G); V = G major (G, B, D)
    // commonWithNext = intersection = {"G"}
    // nextGuideTones = guide tones of G major (3rd = B, no 7th in triad) = {"B"}
    const store = makePlayingStore();
    const { result } = renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.commonWithNext).toEqual(new Set(["G"]));
    expect(result.current!.nextGuideTones).toEqual(new Set(["B"]));
  });

  it("returns null when enabled=false", () => {
    const store = makePlayingStore();
    const { result } = renderHook(() => useFretboardPlaybackSnapshot(false), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBeNull();
  });

  it("returns null when not playing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    // progressionPlayingAtom defaults to false — no setProgressionPlayingAtom call
    store.set(progressionVisualFrameAtom, {
      stepIndex: 0,
      globalFraction: 0.0,
      localFraction: 0.0,
      paused: false,
    });

    const { result } = renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toBeNull();
  });

  it("returns null when frame is missing", () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ]);
    store.set(setProgressionPlayingAtom, true);
    // progressionVisualFrameAtom remains null (default)

    const { result } = renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toBeNull();
  });

  it("updates when progression chord changes", () => {
    const store = makePlayingStore();
    const { result } = renderHook(() => useFretboardPlaybackSnapshot(true), {
      wrapper: makeWrapper(store),
    });

    expect(result.current!.commonWithNext).toEqual(new Set(["G"]));

    // Swap second chord from V→ii — same duration.
    act(() => {
      store.set(progressionStepsAtom, [
        { id: "i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        { id: "ii", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
    });

    // commonWithNext should update to reflect new next chord.
    expect(result.current).not.toBeNull();
  });
});
