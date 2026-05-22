// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { activeProgressionStepIndexAtom, beatsPerBarAtom, progressionStepsAtom } from "../../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/scaleAtoms";
import { SongControls } from "./SongControls";

const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [progressionStepsAtom, [
    { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  ]],
] as const;

describe("SongControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders presets, step list, and active step editor without an on/off toggle", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));

    expect(screen.queryByRole("switch", { name: "Progression mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Preset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^1.*I.*C Major Triad/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Chord root" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Duration value" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Duration unit" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Chord quality" })).toBeInTheDocument();
  });

  it("loads a preset into the editable list", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    // Both the catalog "ii-V-I" preset and the generated suggestion resolve to
    // the same ii-V-I degrees, so either option is a valid pick.
    await user.click(screen.getAllByRole("option", { name: "ii-V-I" })[0]);

    expect(store.get(progressionStepsAtom).map((step) => step.degree)).toEqual(["ii", "V", "I"]);
  });

  it("selects steps and edits degree, duration, and quality", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<SongControls />, store);

    await userEvent.click(screen.getByRole("button", { name: /^2.*V/i }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await userEvent.click(within(screen.getByRole("group", { name: "Chord root" })).getByRole("button", { name: "A vi" }));
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

  it("clears a quality override by re-clicking the active quality", async () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      ]],
    ]);
    renderWithStore(<SongControls />, store);
    const qualityGroup = screen.getByRole("group", { name: "Chord quality" });
    // "7" is the short label for Dominant 7th — it is the active cell.
    await userEvent.click(within(qualityGroup).getByRole("button", { name: "7" }));
    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBeNull();
  });

  it("duplicates the active step via the Duplicate button", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<SongControls />, store);

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
    renderWithStore(<SongControls />, store);

    await userEvent.click(screen.getByRole("button", { name: "Add chord" }));
    expect(store.get(progressionStepsAtom)).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Move chord up" }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "Remove chord" }));
    expect(store.get(progressionStepsAtom)).toHaveLength(2);
  });

  it("does not render a progression on/off toggle", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.queryByRole("switch", { name: "Progression mode" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("SongControls TIME", () => {
  it("renders a Time Signature picker with the default 4/4 value", () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [beatsPerBarAtom, 4],
    ]);
    renderWithStore(<SongControls />, store);
    // The TimeSignaturePicker renders a combobox labelled "Time signature"
    expect(screen.getByLabelText(/time signature/i)).toBeInTheDocument();
    expect(screen.getByText("4/4")).toBeTruthy();
  });
});

describe("SongControls PRESET", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a LabeledSelect with the default preset value", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    renderWithStore(<SongControls />, store);
    const trigger = screen.getByRole("combobox", { name: "Preset" });
    // default I-V-vi-IV preset — the trigger reflects the selected label.
    expect(within(trigger).getByText("I-V-vi-IV")).toBeInTheDocument();
  });

  it("renders preset selector with category groups", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    expect(screen.getByText("Pop / Rock")).toBeInTheDocument();
  });

  it("renders a suggested presets group for the current scale", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    expect(screen.getByText(/^Suggested for/)).toBeInTheDocument();
  });

  it("only lists presets that are available for the selected scale", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Minor Blues"],
    ]);
    renderWithStore(<SongControls />, store);
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

describe("SongControls CHORDS list", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses the section label 'Progression' (not 'Chords' or 'Steps')", () => {
    const { getByText, queryByText } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(getByText("Progression")).toBeTruthy();
    expect(queryByText("Steps")).toBeNull();
  });

  it("rows do not contain the word 'Step'", () => {
    const { queryByText } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(queryByText(/^Step \d/)).toBeNull();
  });

  it("rows show the new duration label ('1 bar', '2 bars' etc.)", () => {
    const { getAllByText } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(getAllByText("1 bar").length).toBeGreaterThan(0);
  });
});

describe("SongControls QUALITY grid", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the selected-chord Quality as a grid, not a scrolling bar", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const qualityGroup = screen.getByRole("group", { name: "Chord quality" });
    expect(qualityGroup).not.toHaveAttribute("data-overflow");
    expect(within(qualityGroup).getByRole("button", { name: "Maj" })).toBeInTheDocument();
  });

  it("has no standalone Diatonic button", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.queryByRole("button", { name: "Diatonic" })).not.toBeInTheDocument();
  });

  it("shows the selected root in the DegreeGrid when a quality override is set", () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th" },
      ]],
    ]);
    renderWithStore(<SongControls />, store);
    // DegreeGrid shows the resolved root (G for V in C Major) as pressed
    const degreeGroup = screen.getByRole("group", { name: "Chord root" });
    expect(within(degreeGroup).getByRole("button", { name: "G V", pressed: true })).toBeInTheDocument();
  });
});

describe("SongControls DEGREE", () => {
  it("renders the DegreeGrid with all 12 chromatic root cells", () => {
    const { getByRole } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const group = getByRole("group", { name: "Chord root" });
    expect(group).toBeTruthy();
    // DegreeGrid always renders all 12 notes; no Off sentinel
    const cells = within(group).getAllByRole("button");
    expect(cells.length).toBe(12);
    expect(within(group).queryByRole("button", { name: "Off" })).toBeNull();
  });
});

describe("SongControls DURATION", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a numeric stepper + Beat/Bar toggle", () => {
    const { getByRole, getByText } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(getByRole("group", { name: /Duration value/i })).toBeTruthy();
    expect(getByText("Beat")).toBeTruthy();
    expect(getByText("Bar")).toBeTruthy();
  });

  it("increments the active chord's duration value", () => {
    const { getByRole, getByLabelText } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    fireEvent.click(getByLabelText(/Increase Duration value/i));
    // The displayed value should now be 2 (within the duration stepper group)
    const durationGroup = getByRole("group", { name: /Duration value/i });
    expect(within(durationGroup).getByText("2")).toBeTruthy();
  });
});

describe("SongControls v2.0", () => {
  it("renders the Time group heading, not Meter", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.queryByText("Meter")).not.toBeInTheDocument();
  });

  it("does not render a Length readout", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.queryByText(/^Length$/)).not.toBeInTheDocument();
  });

  it("renders a Time Signature picker (default 4/4)", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByLabelText(/time signature/i)).toBeInTheDocument();
  });

  it("renders the Preset picker (inside the Progression group's right slot)", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByText("Progression")).toBeInTheDocument();
    expect(screen.getByLabelText(/preset/i)).toBeVisible();
  });
});

describe("SongControls v2.0 chord-edit pane", () => {
  it("renders a 12-cell DegreeGrid (no separate Degree ToggleBar in the edit pane)", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const degreeGrid = screen.getByRole("group", { name: "Chord root" });
    const cells = within(degreeGrid).getAllByRole("button");
    expect(cells.length).toBeGreaterThanOrEqual(12);
  });

  it("does not render a Roman-numeral-only Degree ToggleBar in the edit pane", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const standaloneDegreeButtons = screen
      .queryAllByRole("button", { name: /^I$|^II$|^IV$|^V$|^VI$|^VII$/ });
    expect(standaloneDegreeButtons.length).toBe(0);
  });
});

describe("SongControls grid layout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders Time / Progression / Backing Track group headers", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByRole("heading", { name: "Time" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Progression" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backing Track" })).toBeInTheDocument();
  });

  it("does not render a Loop control", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.queryByRole("switch", { name: "Loop" })).not.toBeInTheDocument();
  });

  it("shows pill + chord-label + counter header for the active chord", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    // The pill class uses CSS Modules so query by role within the header element
    const editorHeader = container.querySelector("header");
    expect(editorHeader).toBeInTheDocument();
    // Chord label shows the resolved chord name
    expect(within(editorHeader!).getByText("C Major Triad")).toBeInTheDocument();
    // Counter shows "Chord 1 / 2" (BASE_SEEDS has 2 steps, index 0 active)
    expect(within(editorHeader!).getByText(/Chord 1 \/ 2/i)).toBeInTheDocument();
    // Pill is present (aria-hidden, so not queryable by accessible name)
    const pillEl = editorHeader!.querySelector("[aria-hidden='true']");
    expect(pillEl).toBeInTheDocument();
    expect(pillEl?.textContent?.trim()).toBe("I");
  });

  it("renders the rehosted backing-track controls", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByRole("combobox", { name: "Genre style" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Chord instrument" })).toBeInTheDocument();
    expect(screen.getByLabelText("Swing amount")).toBeInTheDocument();
  });
});
