import React from "react";
import { describe, expect, it } from "vitest";
import { Provider, createStore } from "jotai";
import { renderHook } from "@testing-library/react";
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
  it("derives beat position and next-step emphasis data from the mirrored playback frame", () => {
    const store = makePlayingStore();
    const { result } = renderHook(() => useFretboardPlaybackSnapshot("lead"), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toMatchObject({
      playing: true,
      activeStepIndex: 0,
      globalFraction: 0.125,
      localFraction: 0.75,
      stepDurationBeats: 4,
      beatPosition: 3,
    });
    expect(result.current!.commonWithNext).toBeInstanceOf(Set);
    expect(result.current!.nextGuideTones).toBeInstanceOf(Set);
  });

  it("returns the correct common tones and guide tones for the default C-major I→V case", () => {
    // C major I = C major (C, E, G); V = G major (G, B, D)
    // commonWithNext = intersection = {"G"}
    // nextGuideTones = guide tones of G major (3rd = B, no 7th in triad) = {"B"}
    const store = makePlayingStore();
    const { result } = renderHook(() => useFretboardPlaybackSnapshot("lead"), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.commonWithNext).toEqual(new Set(["G"]));
    expect(result.current!.nextGuideTones).toEqual(new Set(["B"]));
  });

  it("returns empty sets for commonWithNext and nextGuideTones for non-lead lenses", () => {
    const store = makePlayingStore();

    const { result: resultScale } = renderHook(
      () => useFretboardPlaybackSnapshot("scale"),
      { wrapper: makeWrapper(store) },
    );
    expect(resultScale.current).not.toBeNull();
    expect(resultScale.current!.commonWithNext).toEqual(new Set());
    expect(resultScale.current!.nextGuideTones).toEqual(new Set());

    const { result: resultChord } = renderHook(
      () => useFretboardPlaybackSnapshot("chord"),
      { wrapper: makeWrapper(store) },
    );
    expect(resultChord.current).not.toBeNull();
    expect(resultChord.current!.commonWithNext).toEqual(new Set());
    expect(resultChord.current!.nextGuideTones).toEqual(new Set());

    const { result: resultUndefined } = renderHook(
      () => useFretboardPlaybackSnapshot(undefined),
      { wrapper: makeWrapper(store) },
    );
    expect(resultUndefined.current).not.toBeNull();
    expect(resultUndefined.current!.commonWithNext).toEqual(new Set());
    expect(resultUndefined.current!.nextGuideTones).toEqual(new Set());
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

    const { result } = renderHook(() => useFretboardPlaybackSnapshot("lead"), {
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

    const { result } = renderHook(() => useFretboardPlaybackSnapshot("lead"), {
      wrapper: makeWrapper(store),
    });

    expect(result.current).toBeNull();
  });
});
