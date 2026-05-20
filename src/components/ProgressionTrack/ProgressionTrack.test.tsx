// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { activeProgressionStepIndexAtom, beatsPerBarAtom, progressionStepsAtom } from "../../store/progressionAtoms";
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
  it("renders the timeline group, ruler, and chord blocks", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    expect(screen.getByRole("group", { name: "Progression track" })).toBeTruthy();
    expect(container.querySelector("[aria-label='Progression timeline']")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Step 1, I, C Major Triad, 1 bar, active/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Step 3, vi, A Minor Triad, 2 bars/i })).toBeTruthy();
    // Transport, status lights, and the position/tempo/scale readouts moved
    // to the header transport cluster (Always-On DAW Phase A).
    expect(screen.queryByRole("button", { name: "Play progression" })).toBeNull();
    expect(screen.queryByText("Position")).toBeNull();
  });

  it("renders short chord labels (e.g. C, G7, Am, F) in the visible block text", () => {
    renderWithAtoms(<ProgressionTrack />, [
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

  it("clicking a chord block selects that progression step", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, fourStepProgression],
      [activeProgressionStepIndexAtom, 0],
    ]);
    renderWithStore(<ProgressionTrack />, store);

    fireEvent.click(screen.getByRole("button", { name: /Step 3, vi, A Minor Triad, 2 bars/i }));

    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
  });

  it("sizes beat-duration blocks proportionally to the active meter", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
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
      [progressionStepsAtom, beatDurationProgression],
      [beatsPerBarAtom, 8],
      [activeProgressionStepIndexAtom, 1],
    ]);

    expect(container.querySelector<HTMLElement>("[data-testid='progression-playhead']")?.style.left).toBe("12.5%");
  });

  it("positions chord blocks by exact cumulative bar percentages", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, twoBarLeadingProgression],
      [beatsPerBarAtom, 4],
    ]);

    const first = screen.getByRole("button", { name: /Step 1, I, C Major Triad, 2 bars, active/i });
    const second = screen.getByRole("button", { name: /Step 2, V, G Major Triad, 1 bar/i });
    const third = screen.getByRole("button", { name: /Step 3, vi, A Minor Triad, 1 bar/i });
    const fourth = screen.getByRole("button", { name: /Step 4, IV, F Major Triad, 1 bar/i });

    expect(first.style.left).toBe("0%");
    expect(first.style.width).toBe("calc(40% - 3px)");
    expect(second.style.left).toBe("40%");
    expect(second.style.width).toBe("calc(20% - 3px)");
    expect(third.style.left).toBe("60%");
    expect(third.style.width).toBe("calc(20% - 3px)");
    expect(fourth.style.left).toBe("80%");
    expect(fourth.style.width).toBe("calc(20% - 3px)");
  });

  it("shows spelled-out bar/beat labels in the visible duration span", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    // The duration span must show full words, not abbreviations like "1B" or "2B"
    expect(screen.getAllByText("1 bar", { selector: "span" }).length).toBeGreaterThan(0);
    expect(screen.getByText("2 bars", { selector: "span" })).toBeTruthy();
  });

  it("no longer renders the rehosted backing-track controls", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    // The accompaniment controls moved to the Progression tab (Phase 11).
    expect(screen.queryByLabelText("Genre style")).toBeNull();
    expect(screen.queryByLabelText("Chord instrument")).toBeNull();
    expect(screen.queryByLabelText("Chord pattern")).toBeNull();
    expect(screen.queryByLabelText("Bass pattern")).toBeNull();
    expect(screen.queryByLabelText("Drum pattern")).toBeNull();
    expect(screen.queryByLabelText("Swing amount")).toBeNull();
  });

  it("no longer hosts the transport bar — only the timeline", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    // TransportBar + position readout moved to the header transport cluster
    // (Always-On DAW Phase A); only the timeline stays in ProgressionTrack.
    expect(container.querySelector("[data-testid='transport-bar']")).toBeNull();
    expect(container.querySelector("[aria-label='Progression timeline']")).toBeTruthy();
    expect(screen.queryByText("Position")).toBeNull();
  });
});
