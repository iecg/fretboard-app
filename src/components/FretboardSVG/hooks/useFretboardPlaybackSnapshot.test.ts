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

describe("useFretboardPlaybackSnapshot", () => {
  it("derives beat position and next-step emphasis data from the mirrored playback frame", () => {
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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(Provider, { store }, children)
    );

    const { result } = renderHook(() => useFretboardPlaybackSnapshot("lead"), { wrapper });

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
});
