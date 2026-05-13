// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { TopBandSummary } from "../TopBandSummary/TopBandSummary";
import {
  activeProgressionStepIndexAtom,
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
  practiceLensAtom,
  progressionEnabledAtom,
  progressionStepsAtom,
} from "../../store/atoms";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";

describe("TopBandSummary chord integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the practice bar when a chord is active", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    expect(screen.getByRole("group", { name: /Practice cues/i })).toBeTruthy();
  });

  it("renders the scale degree strip alongside the chord bar", () => {
    const { container } = renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    expect(screen.getByRole("group", { name: "Scale degrees" })).toBeTruthy();
    expect(container.querySelector(".chord-practice-bar")).toBeTruthy();
  });

  it("collapses to a single Land on group when the chord is fully in-scale (targets lens)", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    expect(screen.queryByText("Chord:")).toBeNull();
    expect(screen.getByText("Land on:")).toBeTruthy();
  });

  it("has no accessibility violations on the unified surface", async () => {
    const { container } = renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows read-only current and next progression status in the top band", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [activeProgressionStepIndexAtom, 0],
      [progressionStepsAtom, [
        { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
        { id: "two", degree: "V", duration: "2-bars", qualityOverride: null },
      ]],
    ]);

    expect(screen.getByRole("group", { name: "Progression status" })).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText(/I.*C Major Triad/i)).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText(/V.*G Major Triad/i)).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("1 bar")).toBeInTheDocument();
  });

  it("wraps next progression status to the current step when it is the only playable step", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [activeProgressionStepIndexAtom, 0],
      [progressionStepsAtom, [
        { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
        { id: "bad", degree: "not-a-degree", duration: "1-bar", qualityOverride: null },
      ]],
    ]);

    expect(screen.getByRole("group", { name: "Progression status" })).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getAllByText(/I.*C Major Triad/i)).toHaveLength(2);
    expect(screen.queryByText("End")).not.toBeInTheDocument();
  });

  it("shows a sane blocked status for an empty enabled progression", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, []],
    ]);

    expect(screen.getByRole("group", { name: "Progression status" })).toBeInTheDocument();
    expect(screen.getByText("No steps")).toBeInTheDocument();
    expect(screen.getByText(/Add or load progression steps to start playback/i)).toBeInTheDocument();
    expect(screen.queryByText("Step 1 of 0")).not.toBeInTheDocument();
  });

  it("does not render progression transport controls in the top band", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
        { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
      ]],
    ]);

    expect(screen.queryByRole("button", { name: "Play progression" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Loop progression" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Progression tempo" })).not.toBeInTheDocument();
  });
});
