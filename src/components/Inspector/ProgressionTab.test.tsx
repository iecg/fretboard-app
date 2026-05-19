import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  progressionStepsAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "../../store/atoms";
import { ProgressionTab } from "./ProgressionTab";

const SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [
    progressionStepsAtom,
    [{ id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null }],
  ],
] as const;

describe("ProgressionTab", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the ProgressionControls editor", () => {
    renderWithAtoms(<ProgressionTab />, [...SEEDS]);
    expect(
      screen.getByRole("combobox", { name: "Preset" }),
    ).toBeInTheDocument();
  });

  it("tags its root container with data-inspector-tab=progression", () => {
    const { container } = renderWithAtoms(<ProgressionTab />, [...SEEDS]);
    expect(
      container.querySelector('[data-inspector-tab="progression"]'),
    ).not.toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ProgressionTab />, [...SEEDS]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
