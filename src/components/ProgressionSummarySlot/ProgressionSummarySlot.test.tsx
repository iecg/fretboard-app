// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { makeAtomStore, renderWithAtoms, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  activeProgressionStepIndexAtom,
  beatsPerBarAtom,
  chordTypeAtom,
  progressionEnabledAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  setProgressionPlayingAtom,
} from "../../store/atoms";
import { ProgressionSummarySlot } from "./ProgressionSummarySlot";

const twoBeatProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "beat" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "beat" }, qualityOverride: null },
] as const;

describe("ProgressionSummarySlot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the progression track instead of the top band summary when progression is enabled", () => {
    renderWithAtoms(<ProgressionSummarySlot />, [
      [progressionEnabledAtom, true],
      [chordTypeAtom, "Major Triad"],
    ]);

    expect(screen.getByRole("group", { name: "Progression track" })).toBeTruthy();
    expect(screen.queryByTestId("top-band-summary")).toBeNull();
    expect(screen.queryByTestId("chord-practice-bar")).toBeNull();
  });

  it("renders nothing when progression mode is off", () => {
    const { container } = renderWithAtoms(<ProgressionSummarySlot />, [
      [progressionEnabledAtom, false],
      [chordTypeAtom, "Major Triad"],
    ]);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("top-band-summary")).toBeNull();
    expect(screen.queryByRole("group", { name: "Progression track" })).toBeNull();
  });

  it("keeps progression playback advancing while the progression track is mounted", () => {
    vi.useFakeTimers();
    const store = makeAtomStore([
      [progressionEnabledAtom, true],
      [progressionStepsAtom, twoBeatProgression],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [activeProgressionStepIndexAtom, 0],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<ProgressionSummarySlot />, store);

    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });
});
