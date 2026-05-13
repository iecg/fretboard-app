// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  activeProgressionStepIndexAtom,
  beatsPerBarAtom,
  progressionEnabledAtom,
  progressionLoopEnabledAtom,
  progressionPlayingAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  setProgressionPlayingAtom,
} from "../../store/atoms";
import { ProgressionTrack } from "./ProgressionTrack";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
  { id: "three", degree: "vi", duration: { value: 2, unit: "bar" }, qualityOverride: null },
  { id: "four", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
] as const;

const beatDurationProgression = [
  { id: "beat-step", degree: "I", duration: { value: 2, unit: "beat" }, qualityOverride: null },
  { id: "bar-step", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
] as const;

describe("ProgressionTrack", () => {
  it("renders transport, status, position, tempo, scale, ruler, and chord blocks", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, fourStepProgression],
      [progressionTempoBpmAtom, 90],
      [beatsPerBarAtom, 4],
    ]);

    expect(screen.getByRole("group", { name: "Progression track" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous chord" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next chord" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Loop progression" })).toBeTruthy();
    expect(screen.getByText("Play")).toBeTruthy();
    expect(screen.getByText("Loop")).toBeTruthy();
    expect(screen.getByText("Position")).toBeTruthy();
    expect(screen.getByText("01.1 / 05.4")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(screen.getByText("BPM")).toBeTruthy();
    expect(screen.getByText("C Major (Ionian)")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Step 1, I, C Major Triad, 1 bar, active/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Step 3, vi, A Minor Triad, 2 bars/i })).toBeTruthy();
  });

  it("renders tempo as readout instead of editable tempo controls", () => {
    const { queryByLabelText } = renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionTempoBpmAtom, 112],
    ]);

    expect(screen.getByText("112")).toBeTruthy();
    expect(queryByLabelText(/Increase Tempo/i)).toBeNull();
    expect(queryByLabelText(/Decrease Tempo/i)).toBeNull();
  });

  it("clicking a chord block selects that progression step", () => {
    const store = makeAtomStore([
      [progressionEnabledAtom, true],
      [progressionStepsAtom, fourStepProgression],
      [activeProgressionStepIndexAtom, 0],
    ]);
    renderWithStore(<ProgressionTrack />, store);

    fireEvent.click(screen.getByRole("button", { name: /Step 3, vi, A Minor Triad, 2 bars/i }));

    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
  });

  it("sizes beat-duration blocks proportionally to the active meter", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, beatDurationProgression],
      [beatsPerBarAtom, 8],
    ]);

    expect(
      screen
        .getByRole("button", { name: /Step 1, I, C Major Triad, 2 beats, active/i })
        .style.getPropertyValue("--duration-bars"),
    ).toBe("0.25");
  });

  it("positions the playhead using exact fractional total duration bars", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, beatDurationProgression],
      [beatsPerBarAtom, 8],
      [activeProgressionStepIndexAtom, 1],
    ]);

    expect(container.querySelector<HTMLElement>("[data-testid='progression-playhead']")?.style.left).toBe("20%");
  });

  it("disables playback when progression playback is blocked", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, false],
    ]);

    expect(screen.getByRole("button", { name: "Play progression" })).toBeDisabled();
  });

  it("play and loop controls reflect active state", () => {
    const store = makeAtomStore([
      [progressionEnabledAtom, true],
      [progressionLoopEnabledAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<ProgressionTrack />, store);

    expect(screen.getByRole("button", { name: "Pause progression" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Loop progression" }).getAttribute("aria-pressed")).toBe("true");
    expect(store.get(progressionPlayingAtom)).toBe(true);
  });
});
