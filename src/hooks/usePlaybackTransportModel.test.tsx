// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { usePlaybackTransportModel } from "./usePlaybackTransportModel";
import {
  beatsPerBarAtom,
  displayedStepIndexPrimitiveAtom,
  progressionLoopEnabledAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
} from "../store/progressionAtoms";

const twoStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
] as const;

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
});
