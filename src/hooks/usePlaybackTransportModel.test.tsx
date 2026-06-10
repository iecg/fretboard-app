// @vitest-environment jsdom
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { usePlaybackTransportModel } from "./usePlaybackTransportModel";
import {
  beatsPerBarAtom,
  displayedStepIndexPrimitiveAtom,
  progressionLoopEnabledAtom,
  progressionPlaybackLoadingAtom,
  progressionPlayingAtom,
  progressionPlayingStateAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
} from "../store/progressionAtoms";

const twoStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
] as const;

type TransportModel = ReturnType<typeof usePlaybackTransportModel>;

/**
 * Mount the hook against a fresh store, exposing the latest model snapshot and
 * the store so tests can drive atoms and read the recomputed model back.
 */
function renderModel() {
  const store = createStore();
  const holder: { current: TransportModel | null } = { current: null };

  function Probe() {
    const model = usePlaybackTransportModel();
    // Capture in an effect (not during render) so the react-compiler lint rule
    // stays satisfied; it re-runs on every atom-driven re-render, keeping
    // holder.current pointed at the latest model snapshot.
    useLayoutEffect(() => {
      holder.current = model;
    });
    return null;
  }

  render(
    <Provider store={store}>
      <Probe />
    </Provider>,
  );

  return {
    store,
    get model(): TransportModel {
      if (!holder.current) throw new Error("model not captured");
      return holder.current;
    },
  };
}

describe("usePlaybackTransportModel", () => {
  it("does not re-render when displayedStepIndexPrimitiveAtom changes", () => {
    const store = createStore();
    store.set(progressionStepsAtom as Parameters<typeof store.set>[0], twoStepProgression);
    store.set(beatsPerBarAtom as Parameters<typeof store.set>[0], 4);
    store.set(progressionTempoBpmAtom as Parameters<typeof store.set>[0], 120);
    store.set(progressionLoopEnabledAtom as Parameters<typeof store.set>[0], false);

    const onRender = vi.fn();

    function Probe() {
      usePlaybackTransportModel();
      onRender();
      return null;
    }

    render(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );

    // Capture settled render count after mount
    const countAfterMount = onRender.mock.calls.length;
    expect(countAfterMount).toBeGreaterThanOrEqual(1);

    act(() => {
      store.set(displayedStepIndexPrimitiveAtom, 1);
    });

    // displayedStepIndexPrimitiveAtom is not subscribed to — render count must not increase
    expect(onRender.mock.calls.length).toBe(countAfterMount);
  });

  describe("play/stop button model", () => {
    it("disables play when stopped and playback is blocked (no steps)", () => {
      const { store, model } = (() => {
        const r = renderModel();
        act(() => {
          r.store.set(progressionStepsAtom as Parameters<typeof r.store.set>[0], []);
        });
        return r;
      })();

      // Empty progression → blocked reason set, not playing → disabled.
      expect(store.get(progressionPlayingAtom)).toBe(false);
      expect(model.progressionPlaybackBlockedReason).not.toBeNull();
      expect(model.playStopDisabled).toBe(true);
    });

    it("disables play when stopped and a load is in flight", () => {
      const r = renderModel();
      act(() => {
        r.store.set(progressionStepsAtom as Parameters<typeof r.store.set>[0], twoStepProgression);
        r.store.set(progressionPlaybackLoadingAtom, true);
      });

      // Steps are present (so not blocked) but a warm-up load is pending.
      expect(r.model.progressionPlaybackBlockedReason).toBeNull();
      expect(r.model.progressionPlaybackLoading).toBe(true);
      expect(r.model.playStopDisabled).toBe(true);
    });

    it("enables play when stopped, unblocked, and not loading", () => {
      const r = renderModel();
      act(() => {
        r.store.set(progressionStepsAtom as Parameters<typeof r.store.set>[0], twoStepProgression);
      });

      expect(r.model.progressionPlaybackBlockedReason).toBeNull();
      expect(r.model.playStopDisabled).toBe(false);
    });

    it("never disables the button while playing, even mid-load", () => {
      const r = renderModel();
      act(() => {
        r.store.set(progressionStepsAtom as Parameters<typeof r.store.set>[0], twoStepProgression);
        r.store.set(progressionPlayingStateAtom, true);
        r.store.set(progressionPlaybackLoadingAtom, true);
      });

      // Playing → user must always be able to stop, so disabled stays false.
      expect(r.model.progressionPlaying).toBe(true);
      expect(r.model.playStopDisabled).toBe(false);
    });

    it("reports the play label key when stopped and the stop key when playing", () => {
      const r = renderModel();
      act(() => {
        r.store.set(progressionStepsAtom as Parameters<typeof r.store.set>[0], twoStepProgression);
      });
      expect(r.model.playStopLabelKey).toBe("controls.playProgressionTooltip");

      act(() => {
        r.store.set(progressionPlayingStateAtom, true);
      });
      expect(r.model.playStopLabelKey).toBe("controls.stopProgression");
    });

    it("starts playback on click when stopped and unblocked", () => {
      const r = renderModel();
      act(() => {
        r.store.set(progressionStepsAtom as Parameters<typeof r.store.set>[0], twoStepProgression);
      });
      expect(r.store.get(progressionPlayingAtom)).toBe(false);

      act(() => {
        r.model.handlePlayStopClick();
      });
      expect(r.store.get(progressionPlayingAtom)).toBe(true);
    });

    it("stops playback on click when already playing", () => {
      const r = renderModel();
      act(() => {
        r.store.set(progressionStepsAtom as Parameters<typeof r.store.set>[0], twoStepProgression);
        r.store.set(progressionPlayingStateAtom, true);
      });
      expect(r.store.get(progressionPlayingAtom)).toBe(true);

      act(() => {
        r.model.handlePlayStopClick();
      });
      expect(r.store.get(progressionPlayingAtom)).toBe(false);
    });
  });
});
