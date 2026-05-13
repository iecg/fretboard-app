// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  activeProgressionStepIndexAtom,
  progressionEnabledAtom,
  progressionStepsAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "../../store/atoms";
import { ProgressionControls } from "./ProgressionControls";

const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [progressionEnabledAtom, true],
  [progressionStepsAtom, [
    { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
    { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
  ]],
] as const;

describe("ProgressionControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders enable toggle, presets, step list, and active step editor", () => {
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));

    expect(screen.getByRole("group", { name: "Progression mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I-V-vi-IV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Step 1.*I.*C Major Triad/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Progression degree" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Step duration" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Step chord quality" })).toBeInTheDocument();
  });

  it("loads a preset into the editable list", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    await userEvent.click(screen.getByRole("button", { name: "ii-V-I" }));

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual(["ii", "V", "I"]);
    expect(store.get(progressionEnabledAtom)).toBe(true);
  });

  it("selects steps and edits degree, duration, and quality", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    await userEvent.click(screen.getByRole("button", { name: /Step 2/i }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await userEvent.click(within(screen.getByRole("group", { name: "Progression degree" })).getByRole("button", { name: "vi" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Step duration" })).getByRole("button", { name: "2 bars" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Step chord quality" })).getByRole("button", { name: "7" }));

    expect(store.get(progressionStepsAtom)[1]).toMatchObject({
      degree: "vi",
      duration: "2-bars",
      qualityOverride: "Dominant 7th",
    });
  });

  it("clears a quality override with Diatonic", async () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: "1-bar", qualityOverride: "Dominant 7th" },
      ]],
    ]);
    renderWithStore(<ProgressionControls />, store);

    await userEvent.click(within(screen.getByRole("group", { name: "Step chord quality" })).getByRole("button", { name: "Diatonic" }));

    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBeNull();
  });

  it("adds, removes, and reorders steps", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    await userEvent.click(screen.getByRole("button", { name: "Add step" }));
    expect(store.get(progressionStepsAtom)).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Move step up" }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "Remove step" }));
    expect(store.get(progressionStepsAtom)).toHaveLength(2);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(await axe(container)).toHaveNoViolations();
  });
});
