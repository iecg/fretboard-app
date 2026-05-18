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
  progressionLoopEnabledAtom,
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

    expect(screen.getByRole("switch", { name: "Progression mode" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Preset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^1.*I.*C Major Triad/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Progression degree" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Duration value" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Duration unit" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Chord quality" })).toBeInTheDocument();
  });

  it("loads a preset into the editable list", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    // Both the catalog "ii-V-I" preset and the generated suggestion resolve to
    // the same ii-V-I degrees, so either option is a valid pick.
    await user.click(screen.getAllByRole("option", { name: "ii-V-I" })[0]);

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual(["ii", "V", "I"]);
    expect(store.get(progressionEnabledAtom)).toBe(true);
  });

  it("selects steps and edits degree, duration, and quality", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    await userEvent.click(screen.getByRole("button", { name: /^2.*V/i }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await userEvent.click(within(screen.getByRole("group", { name: "Progression degree" })).getByRole("button", { name: "vi" }));
    // Set duration value to 2 via stepper
    fireEvent.click(screen.getByLabelText(/Increase Duration value/i));
    // Set duration unit to Bar
    await userEvent.click(within(screen.getByRole("group", { name: "Duration unit" })).getByRole("button", { name: "Bar" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Chord quality" })).getByRole("button", { name: "7" }));

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

    await userEvent.click(screen.getByRole("button", { name: "Diatonic" }));

    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBeNull();
  });

  it("duplicates the active step via the Duplicate button", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    // BASE_SEEDS active index defaults to 0 -> the "I" step is active.
    await userEvent.click(screen.getByRole("button", { name: /duplicate chord/i }));

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual([
      "I",
      "I",
      "V",
    ]);
  });

  it("adds, removes, and reorders steps", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionControls />, store);

    await userEvent.click(screen.getByRole("button", { name: "Add chord" }));
    expect(store.get(progressionStepsAtom)).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Move chord up" }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "Remove chord" }));
    expect(store.get(progressionStepsAtom)).toHaveLength(2);
  });

  it("toggles progression mode via the Switch", () => {
    const store = makeAtomStore([[progressionEnabledAtom, false]]);
    renderWithStore(<ProgressionControls />, store);
    const sw = screen.getByRole("switch", { name: "Progression mode" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(store.get(progressionEnabledAtom)).toBe(true);
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
    // The "Beats per bar" stepper label is hidden inside its Prop cell; the
    // cell's own "Beats/Bar" micro-label is the visible heading.
    expect(screen.getByText("Beats/Bar")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Increase Beats per bar/i));
    expect(screen.getByText("6")).toBeTruthy();
  });
});

describe("ProgressionControls PRESET", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a LabeledSelect with the default preset value", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
    ]);
    renderWithStore(<ProgressionControls />, store);
    const trigger = screen.getByRole("combobox", { name: "Preset" });
    // default I-V-vi-IV preset — the trigger reflects the selected label.
    expect(within(trigger).getByText("I-V-vi-IV")).toBeInTheDocument();
  });

  it("renders preset selector with category groups", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
    ]);
    renderWithStore(<ProgressionControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    expect(screen.getByText("Pop / Rock")).toBeInTheDocument();
  });

  it("renders a suggested presets group for the current scale", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionEnabledAtom, true],
    ]);
    renderWithStore(<ProgressionControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    expect(screen.getByText(/^Suggested for/)).toBeInTheDocument();
  });

  it("only lists presets that are available for the selected scale", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Minor Blues"],
      [progressionEnabledAtom, true],
    ]);
    renderWithStore(<ProgressionControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    const optionLabels = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(optionLabels[0]).toBe("Custom");
    expect(optionLabels).toEqual(
      expect.arrayContaining([
        "I-V-vi-IV",
        "ii-V-I",
        "I-vi-IV-V",
        "I-IV-V",
        "12-bar blues",
      ]),
    );
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

describe("ProgressionControls QUALITY grid", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the selected-chord Quality as a grid, not a scrolling bar", () => {
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    const qualityGroup = screen.getByRole("group", { name: "Chord quality" });
    expect(qualityGroup).not.toHaveAttribute("data-overflow");
    expect(within(qualityGroup).getByRole("button", { name: "Maj" })).toBeInTheDocument();
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

describe("ProgressionControls DURATION", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a numeric stepper + Beat/Bar toggle", () => {
    const { getByRole, getByText } = renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(getByRole("group", { name: /Duration value/i })).toBeTruthy();
    expect(getByText("Beat")).toBeTruthy();
    expect(getByText("Bar")).toBeTruthy();
  });

  it("increments the active chord's duration value", () => {
    const { getByRole, getByLabelText } = renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    fireEvent.click(getByLabelText(/Increase Duration value/i));
    // The displayed value should now be 2 (within the duration stepper group)
    const durationGroup = getByRole("group", { name: /Duration value/i });
    expect(within(durationGroup).getByText("2")).toBeTruthy();
  });
});

describe("ProgressionControls grid layout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders Meter / Chords / Backing Track group headers", () => {
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByRole("heading", { name: "Meter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chords" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backing Track" })).toBeInTheDocument();
  });

  it("renders a Loop switch bound to progressionLoopEnabledAtom", async () => {
    const store = makeAtomStore([...BASE_SEEDS, [progressionLoopEnabledAtom, false]]);
    renderWithStore(<ProgressionControls />, store);
    const loop = screen.getByRole("switch", { name: "Loop" });
    expect(loop.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(loop);
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);
  });

  it("shows the progression length readout", () => {
    // BASE_SEEDS is two 1-bar steps -> a 2-bar progression.
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByText("2 bars")).toBeInTheDocument();
  });

  it("renders the rehosted backing-track controls", () => {
    renderWithStore(<ProgressionControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByLabelText("Genre style")).toBeInTheDocument();
    expect(screen.getByLabelText("Chord instrument")).toBeInTheDocument();
    expect(screen.getByLabelText("Swing amount")).toBeInTheDocument();
  });
});
