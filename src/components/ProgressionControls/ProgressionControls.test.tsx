// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  activeProgressionStepIndexAtom,
  beatsPerBarAtom,
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
    { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  ]],
] as const;

describe("ProgressionControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders enable toggle, presets, step list, and active step editor", () => {
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));

    expect(screen.getByRole("group", { name: "Progression mode" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Preset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^1.*I.*C Major Triad/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Progression degree" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Step duration" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Step chord quality" })).toBeInTheDocument();
  });

  it("renders progression playback controls inside the progression panel", () => {
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));

    expect(screen.getByRole("group", { name: "Progression playback" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous progression step" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next progression step" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Loop progression" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Progression tempo" })).toBeInTheDocument();
  });

  it("loads a preset into the editable list", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Preset" }), "two-five-one");

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual(["ii", "V", "I"]);
    expect(store.get(progressionEnabledAtom)).toBe(true);
  });

  it("selects steps and edits degree, duration, and quality", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    await userEvent.click(screen.getByRole("button", { name: /^2.*V/i }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await userEvent.click(within(screen.getByRole("group", { name: "Progression degree" })).getByRole("button", { name: "vi" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Step duration" })).getByRole("button", { name: "2 bars" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Step chord quality" })).getByRole("button", { name: "7" }));

    expect(store.get(progressionStepsAtom)[1]).toMatchObject({
      degree: "vi",
      duration: { value: 2, unit: "bar" },
      qualityOverride: "Dominant 7th",
    });
  });

  it("clears a quality override with Diatonic", async () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
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

describe("ProgressionControls METER", () => {
  it("renders a Beats per bar stepper that cycles 3→4→6→8", () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [beatsPerBarAtom, 4],
    ]);
    renderWithStore(<ProgressionControls />, store);
    expect(screen.getByText("Beats per bar")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Increase Beats per bar/i));
    expect(screen.getByText("6")).toBeTruthy();
  });
});

describe("ProgressionControls PRESET", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a LabeledSelect with default preset value", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
    ]);
    renderWithStore(<ProgressionControls />, store);
    const select = screen.getByLabelText(/Preset/i) as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(select.value).toBe("one-five-six-four"); // default I-V-vi-IV preset
  });
});

describe("ProgressionControls CHORDS list", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses the section label 'Chords' (not 'Steps')", () => {
    const { getByText, queryByText } = renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(getByText("Chords")).toBeTruthy();
    expect(queryByText("Steps")).toBeNull();
  });

  it("rows do not contain the word 'Step'", () => {
    const { queryByText } = renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(queryByText(/^Step \d/)).toBeNull();
  });

  it("rows show the new duration label ('1 bar', '2 bars' etc.)", () => {
    const { getAllByText } = renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(getAllByText("1 bar").length).toBeGreaterThan(0);
  });
});

describe("ProgressionControls DEGREE", () => {
  it("uses the shared degree option builder (degree-only, no Off sentinel)", () => {
    const { getByLabelText } = renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    const group = getByLabelText("Progression degree");
    expect(group).toBeTruthy();
    // No "Off" button inside the degree toggle group itself
    expect(within(group).queryByRole("button", { name: "Off" })).toBeNull();
  });
});
