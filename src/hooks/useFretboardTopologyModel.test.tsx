// @vitest-environment jsdom
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { useFretboardPlaybackSnapshot } from "../components/FretboardSVG/hooks/useFretboardPlaybackSnapshot";
import { progressionVisualFrameAtom } from "../store/progressionVisualAtoms";
import { useFretboardTopologyModel } from "./useFretboardTopologyModel";

describe("useFretboardTopologyModel", () => {
  it("does not rerender on playback tick while a sibling playback hook does", () => {
    const store = createStore();
    store.set(progressionVisualFrameAtom, {
      stepIndex: 0,
      globalFraction: 0,
      localFraction: 0,
      paused: false,
    });

    let topologyCommits = 0;
    let playbackCommits = 0;
    let topologySnapshot: ReturnType<typeof useFretboardTopologyModel> | undefined;

    function TopologyProbe() {
      const model = useFretboardTopologyModel();
      // Effect-time increment keeps the component body pure (React Compiler safe)
      // while observing one increment per committed render.
      useEffect(() => {
        topologyCommits += 1;
        topologySnapshot = model;
      });
      return null;
    }

    function PlaybackProbe() {
      useFretboardPlaybackSnapshot(true);
      useEffect(() => {
        playbackCommits += 1;
      });
      return null;
    }

    render(
      <Provider store={store}>
        <TopologyProbe />
        <PlaybackProbe />
      </Provider>,
    );

    const topologyBaseline = topologyCommits;
    const playbackBaseline = playbackCommits;
    const initialTopologySnapshot = topologySnapshot;

    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.5,
        localFraction: 0.5,
        paused: false,
      });
    });

    expect(playbackCommits).toBeGreaterThan(playbackBaseline);
    expect(topologyCommits).toBe(topologyBaseline);
    expect(topologySnapshot).toBe(initialTopologySnapshot);
  });
});
