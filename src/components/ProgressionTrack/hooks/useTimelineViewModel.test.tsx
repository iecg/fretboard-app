// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import * as builderModule from "./buildTimelineViewModel";
import { useTimelineViewModel } from "./useTimelineViewModel";
import {
  beatsPerBarAtom,
  displayedStepIndexPrimitiveAtom,
  progressionStepsAtom,
  setProgressionPlayingAtom,
} from "../../../store/progressionAtoms";

vi.mock("./buildTimelineViewModel", async (importOriginal) => {
  const actual = await importOriginal<typeof builderModule>();
  return {
    ...actual,
    buildTimelineViewModel: vi.fn(actual.buildTimelineViewModel),
  };
});

const twoSteps = [
  { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
] as const;

describe("useTimelineViewModel", () => {
  beforeEach(() => {
    vi.mocked(builderModule.buildTimelineViewModel).mockClear();
  });

  it("keeps blockLayouts reference stable and calls buildTimelineViewModel only once when displayedStepIndexPrimitiveAtom changes", async () => {
    const store = createStore();
    store.set(progressionStepsAtom, twoSteps as never);
    store.set(beatsPerBarAtom, 4);
    store.set(setProgressionPlayingAtom, true);

    const spy = vi.mocked(builderModule.buildTimelineViewModel);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTimelineViewModel(), { wrapper });

    const initialBlockLayouts = result.current.blockLayouts;
    const callCountAfterMount = spy.mock.calls.length;

    await act(async () => {
      store.set(displayedStepIndexPrimitiveAtom, 1);
    });

    expect(result.current.blockLayouts).toBe(initialBlockLayouts);
    expect(spy.mock.calls.length).toBe(callCountAfterMount);
  });
});
