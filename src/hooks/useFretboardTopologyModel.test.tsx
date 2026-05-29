// @vitest-environment jsdom
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { progressionVisualFrameAtom } from "../store/progressionVisualAtoms";
import { useFretboardTopologyModel } from "./useFretboardTopologyModel";
import {
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";

describe("useFretboardTopologyModel", () => {
  it("does not rerender on playback tick", () => {
    const store = createStore();
    store.set(setProgressionPlayingAtom, true);
    store.set(progressionVisualFrameAtom, {
      stepIndex: 0,
      globalFraction: 0,
      localFraction: 0,
      paused: false,
    });

    let topologyCommits = 0;
    let topologySnapshot: ReturnType<typeof useFretboardTopologyModel> | undefined;

    function TopologyProbe() {
      const model = useFretboardTopologyModel();
      useEffect(() => {
        topologyCommits += 1;
        topologySnapshot = model;
      });
      return null;
    }

    render(
      <Provider store={store}>
        <TopologyProbe />
      </Provider>,
    );

    const topologyBaseline = topologyCommits;
    const initialTopologySnapshot = topologySnapshot;

    // Simulate a frame tick: same stepIndex, different globalFraction.
    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.5,
        localFraction: 0.5,
        paused: false,
      });
    });

    // Topology model should not re-render — it doesn't read the frame atom.
    expect(topologyCommits).toBe(topologyBaseline);
    expect(topologySnapshot).toBe(initialTopologySnapshot);
  });
});
