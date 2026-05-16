import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithAtoms,
  makeAtomStore,
  renderWithStore,
} from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  progressionEnabledAtom,
  progressionStepsAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "../../store/atoms";
import { ChordSelectionCallout } from "./ChordSelectionCallout";

const PROGRESSION_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [progressionEnabledAtom, true],
  [
    progressionStepsAtom,
    [
      { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
      { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    ],
  ],
] as const;

describe("ChordSelectionCallout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the overlay variant when progression mode is off", () => {
    const { container } = renderWithAtoms(<ChordSelectionCallout />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, false],
    ]);
    expect(
      container.querySelector('[data-callout-variant="overlay"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-callout-variant="progression"]'),
    ).toBeNull();
  });

  it("shows the progression variant with Duplicate/Remove when a step is the chord source", () => {
    const { container } = renderWithAtoms(<ChordSelectionCallout />, [
      ...PROGRESSION_SEEDS,
    ]);
    expect(
      container.querySelector('[data-callout-variant="progression"]'),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("Duplicate inserts a copy of the active step", async () => {
    const user = userEvent.setup();
    const store = makeAtomStore([...PROGRESSION_SEEDS]);
    renderWithStore(<ChordSelectionCallout />, store);

    await user.click(screen.getByRole("button", { name: /duplicate/i }));

    const steps = store.get(progressionStepsAtom);
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.degree)).toEqual(["I", "I", "V"]);
  });

  it("Remove deletes the active step", async () => {
    const user = userEvent.setup();
    const store = makeAtomStore([...PROGRESSION_SEEDS]);
    renderWithStore(<ChordSelectionCallout />, store);

    await user.click(screen.getByRole("button", { name: /remove/i }));

    expect(store.get(progressionStepsAtom).map((s) => s.degree)).toEqual(["V"]);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ChordSelectionCallout />, [
      ...PROGRESSION_SEEDS,
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
