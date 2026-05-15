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

const twoBarLeadingProgression = [
  { id: "one", degree: "I", duration: { value: 2, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "three", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "four", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
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
    expect(screen.getByLabelText("Position 01.1.000 of 05.4.000")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(screen.getByText("BPM")).toBeTruthy();
    // Scale label is split into primary + secondary (in parentheses).
    expect(screen.getByText("C Major")).toBeTruthy();
    expect(screen.getByText("Ionian")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Step 1, I, C Major Triad, 1 bar, active/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Step 3, vi, A Minor Triad, 2 bars/i })).toBeTruthy();
  });

  it("renders short chord labels (e.g. C, G7, Am, F) in the visible block text", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    // Verbose names stay in aria-label for accessibility; the visible chord-name
    // span uses the compact idiomatic form.
    expect(screen.getByText("C", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("G7", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Am", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("F", { selector: "span" })).toBeTruthy();
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
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, beatDurationProgression],
      [beatsPerBarAtom, 8],
    ]);

    expect(container.querySelector<HTMLElement>("[aria-label='Progression timeline']")?.style.getPropertyValue("--bar-count")).toBe("2");
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

    expect(container.querySelector<HTMLElement>("[data-testid='progression-playhead']")?.style.left).toBe("12.5%");
  });

  it("positions chord blocks by exact cumulative bar percentages", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, twoBarLeadingProgression],
      [beatsPerBarAtom, 4],
    ]);

    const first = screen.getByRole("button", { name: /Step 1, I, C Major Triad, 2 bars, active/i });
    const second = screen.getByRole("button", { name: /Step 2, V, G Major Triad, 1 bar/i });
    const third = screen.getByRole("button", { name: /Step 3, vi, A Minor Triad, 1 bar/i });
    const fourth = screen.getByRole("button", { name: /Step 4, IV, F Major Triad, 1 bar/i });

    expect(first.style.left).toBe("0%");
    expect(first.style.width).toBe("40%");
    expect(second.style.left).toBe("40%");
    expect(second.style.width).toBe("20%");
    expect(third.style.left).toBe("60%");
    expect(third.style.width).toBe("20%");
    expect(fourth.style.left).toBe("80%");
    expect(fourth.style.width).toBe("20%");
  });

  it("shows spelled-out bar/beat labels in the visible duration span", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionEnabledAtom, true],
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    // The duration span must show full words, not abbreviations like "1B" or "2B"
    expect(screen.getAllByText("1 bar", { selector: "span" }).length).toBeGreaterThan(0);
    expect(screen.getByText("2 bars", { selector: "span" })).toBeTruthy();
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
