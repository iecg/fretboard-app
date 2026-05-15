// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { TopBandSummary } from "../TopBandSummary/TopBandSummary";
import {
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

  it("does not render progression transport controls in the top band", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
      [progressionStepsAtom, [
        { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      ]],
    ]);

    expect(screen.queryByRole("button", { name: "Play progression" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Loop progression" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Progression tempo" })).not.toBeInTheDocument();
  });
});
