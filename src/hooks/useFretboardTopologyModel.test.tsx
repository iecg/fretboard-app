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
    // Sibling-probe contract test: ticking a playback-only atom
    // (progressionVisualFrameAtom) must invalidate the playback snapshot
    // consumer while leaving the topology consumer untouched. If a future
    // change re-inlines a playback subscription into the topology model,
    // the topology probe's render count will start incrementing and this
    // assertion will fail.
    //
    // Note: useFretboardPlaybackSnapshot returns null when not playing, but
    // its useAtomValue subscriptions still fire on atom writes, so the
    // playback probe re-renders even without seeding progressionPlayingAtom.
    const store = createStore();
    store.set(progressionVisualFrameAtom, {
      stepIndex: 0,
      globalFraction: 0,
      localFraction: 0,
      paused: false,
    });

    let topologyCommits = 0;
    let playbackCommits = 0;

    function TopologyProbe() {
      useFretboardTopologyModel();
      // Effect-time increment keeps the component body pure (React Compiler safe)
      // while observing one increment per committed render.
      useEffect(() => {
        topologyCommits += 1;
      });
      return null;
    }

    function PlaybackProbe() {
      useFretboardPlaybackSnapshot();
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

    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.5,
        localFraction: 0.5,
        paused: false,
      });
    });

    // Sanity check: the playback hook DID see the tick (otherwise the test
    // would be a tautology — it could pass simply because nothing subscribed).
    expect(playbackCommits).toBeGreaterThan(playbackBaseline);
    // Contract: topology hook remains untouched by playback ticks.
    expect(topologyCommits).toBe(topologyBaseline);
  });
});
