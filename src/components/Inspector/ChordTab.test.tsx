import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  progressionEnabledAtom,
  progressionStepsAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "../../store/atoms";
import { ChordTab } from "./ChordTab";

const PROGRESSION_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [progressionEnabledAtom, true],
  [
    progressionStepsAtom,
    [{ id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null }],
  ],
] as const;

describe("ChordTab", () => {
  it("renders ChordOverlayControls", () => {
    renderWithAtoms(<ChordTab />);
    expect(screen.getByText(/chord mode/i)).toBeInTheDocument();
  });

  it("tags its root container with data-inspector-tab=chord", () => {
    const { container } = renderWithAtoms(<ChordTab />);
    expect(
      container.querySelector('[data-inspector-tab="chord"]'),
    ).not.toBeNull();
  });

  it("uses the overlay accent when progression mode is off", () => {
    const { container } = renderWithAtoms(<ChordTab />, [
      [progressionEnabledAtom, false],
    ]);
    expect(
      container.querySelector('[data-chord-accent="overlay"]'),
    ).not.toBeNull();
  });

  it("uses the progression accent when a progression step is the chord source", () => {
    const { container } = renderWithAtoms(<ChordTab />, [...PROGRESSION_SEEDS]);
    expect(
      container.querySelector('[data-chord-accent="progression"]'),
    ).not.toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ChordTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
