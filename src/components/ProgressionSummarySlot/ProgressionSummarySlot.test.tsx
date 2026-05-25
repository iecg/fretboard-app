// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { makeAtomStore, renderWithAtoms, renderWithStore } from "../../test-utils/renderWithAtoms";
import { activeProgressionStepIndexAtom, beatsPerBarAtom, progressionStepsAtom, progressionTempoBpmAtom, setProgressionPlayingAtom } from "../../store/progressionAtoms";
import { ProgressionSummarySlot } from "./ProgressionSummarySlot";

const twoBeatProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "beat" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "beat" }, qualityOverride: null },
] as const;

describe("ProgressionSummarySlot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("always renders the progression track", () => {
    renderWithAtoms(<ProgressionSummarySlot />, [
      [progressionStepsAtom, [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "M", manualRoot: "C" },
      ]],
    ]);

    expect(screen.getByRole("group", { name: "Progression track" })).toBeTruthy();
    expect(screen.queryByTestId("top-band-summary")).toBeNull();
    expect(screen.queryByTestId("chord-practice-bar")).toBeNull();
  });

  it("mounts the progression audio playback hook without crashing on play", () => {
    // Progression advance is now driven by Tone.Part callbacks scheduled on
    // the audio clock (see useProgressionAudioPlayback), not by the React
    // setInterval loop. Asserting timer-driven advance here would require a
    // real AudioContext; we instead verify the slot hosts the playback hook
    // without throwing when playback starts.
    const store = makeAtomStore([
      [progressionStepsAtom, twoBeatProgression],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [activeProgressionStepIndexAtom, 0],
    ]);
    store.set(setProgressionPlayingAtom, true);
    expect(() => {
      renderWithStore(<ProgressionSummarySlot />, store);
    }).not.toThrow();
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });
});
