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
  [scaleNameAtom, "major"],
  [progressionStepsAtom, [
    { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
    { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  ]],
] as const;

describe("SongControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders preset selector and active step editor without an on/off toggle", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));

    expect(screen.queryByRole("switch", { name: "Progression mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Preset" })).toBeInTheDocument();
    // Step list is gone (ProgressionTrack handles navigation); editor pane still present
    expect(screen.getByRole("group", { name: "Chord root" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Duration value" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Duration unit" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Quality" })).toBeInTheDocument();
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
    // Seed with step 2 (V) active — ProgressionTrack handles step navigation,
    // so we seed the atom directly rather than clicking a removed step list.
    const store = makeAtomStore([...BASE_SEEDS, [activeProgressionStepIndexAtom, 1]]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();

    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await user.click(within(screen.getByRole("group", { name: "Chord root" })).getByRole("button", { name: "A vi" }));
    // Set duration value to 2 via stepper
    fireEvent.click(screen.getByLabelText(/Increase Duration value/i));
    // Set duration unit to Bar
    await user.click(within(screen.getByRole("group", { name: "Duration unit" })).getByRole("button", { name: "Bar" }));
    // Select quality via combobox
    await user.click(screen.getByRole("combobox", { name: "Quality" }));
    await user.click(screen.getByRole("option", { name: "7" }));

    expect(store.get(progressionStepsAtom)[1]).toMatchObject({
      degree: "vi",
      duration: { value: 2, unit: "bar" },
      qualityOverride: "7",
    });
  });

  it("keeps the quality override sticky on re-select (does not null it)", async () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
      ]],
    ]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();
    // "7" is the short label for Dominant 7th — it is the active value.
    // Re-selecting the already-active quality via the combobox should keep the override, not null it.
    await user.click(screen.getByRole("combobox", { name: "Quality" }));
    await user.click(screen.getByRole("option", { name: "7" }));
    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBe("7");
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
      [scaleNameAtom, "major"],
    ]);
    renderWithStore(<SongControls />, store);
    const trigger = screen.getByRole("combobox", { name: "Preset" });
    // default I-V-vi-IV preset — the trigger reflects the selected label.
    expect(within(trigger).getByText("I-V-vi-IV")).toBeInTheDocument();
  });

  it("renders preset selector with category groups", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
    ]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    expect(screen.getByText("Pop / Rock")).toBeInTheDocument();
  });

  it("renders a suggested presets group for the current scale", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
    ]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Preset" }));
    expect(screen.getByText(/^Suggested for/)).toBeInTheDocument();
  });

  it("only lists presets that are available for the selected scale", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "minor blues"],
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

  it("the editor pane shows duration controls (step-list rows are gone)", () => {
    // The step-list rows (which used formatProgressionDurationLabel) are removed.
    // The editor pane still exposes duration via its stepper + toggle controls.
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByRole("group", { name: "Duration value" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Duration unit" })).toBeInTheDocument();
  });
});

describe("SongControls QUALITY dropdown", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the selected-chord Quality as a combobox (not a button grid)", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.getByRole("combobox", { name: "Quality" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Maj" })).not.toBeInTheDocument();
  });

  it("has no standalone Diatonic button", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(screen.queryByRole("button", { name: "Diatonic" })).not.toBeInTheDocument();
  });

  it("opens with grouped options: Triads, Suspended / Power, 6th Chords, 7th Chords", async () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Quality" }));
    expect(screen.getByText("Triads")).toBeInTheDocument();
    expect(screen.getByText("Suspended / Power")).toBeInTheDocument();
    expect(screen.getByText("6th Chords")).toBeInTheDocument();
    expect(screen.getByText("7th Chords")).toBeInTheDocument();
  });

  it("selecting a quality option calls updateProgressionStepQuality", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Quality" }));
    await user.click(screen.getByRole("option", { name: "M7" }));
    expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBe("maj7");
  });

  it("shows the selected root in the DegreeGrid when a quality override is set", () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [progressionStepsAtom, [
        { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
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

describe("SongControls KEY section layout", () => {
  it("renders Root and Scale dropdowns in the KEY section", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    // Both comboboxes must be present — layout is CSS-driven (span={3} each in a 6-col grid)
    const rootCombos = screen.getAllByRole("combobox", { name: "Root" });
    expect(rootCombos.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("combobox", { name: "Scale" })).toBeInTheDocument();
  });

  it("Scale select uses fill width (no data-width attribute)", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const scaleTrigger = screen.getByRole("combobox", { name: "Scale" });
    // fill mode means no data-width attribute on the wrapper
    const fixedWrapper = scaleTrigger.closest("[data-width='fixed']");
    const autoWrapper = scaleTrigger.closest("[data-width='auto']");
    expect(fixedWrapper).toBeNull();
    expect(autoWrapper).toBeNull();
  });

  it("Progression Preset select uses fill width (no data-width attribute)", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const presetTrigger = screen.getByRole("combobox", { name: "Preset" });
    // fill mode means no data-width attribute on the wrapper
    const fixedWrapper = presetTrigger.closest("[data-width='fixed']");
    const autoWrapper = presetTrigger.closest("[data-width='auto']");
    expect(fixedWrapper).toBeNull();
    expect(autoWrapper).toBeNull();
  });
});

describe("SongControls ROOT dropdown (KEY section)", () => {
  it("renders the song key Root as a combobox with 12 options", async () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const user = userEvent.setup();
    // The KEY section root is a LabeledSelect combobox
    const rootCombos = screen.getAllByRole("combobox", { name: "Root" });
    expect(rootCombos.length).toBeGreaterThanOrEqual(1);
    // Open and verify 12 note options
    await user.click(rootCombos[0]);
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(12);
  });

  it("selecting a root note updates rootNoteAtom", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<SongControls />, store);
    const user = userEvent.setup();
    const rootCombos = screen.getAllByRole("combobox", { name: "Root" });
    await user.click(rootCombos[0]);
    await user.click(screen.getByRole("option", { name: "G" }));
    expect(store.get(rootNoteAtom)).toBe("G");
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

describe("SongControls G11c: editor pane full-width + 2-col grid + borrowed quality clear", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("editor pane spans the full Inspector row (span=6)", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    // The editor-cell wrapper sits inside a .prop with data-span="6"
    const editorCell = container.querySelector("[class*='editor-cell']");
    expect(editorCell).toBeTruthy();
    const propWrapper = editorCell?.closest("[data-span]");
    expect(propWrapper?.getAttribute("data-span")).toBe("6");
  });

  it("renders Duration and Quality in a 2-column editor-grid", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const editorCell = container.querySelector("[class*='editor-cell']");
    expect(editorCell).toBeTruthy();
    const editorGrid = editorCell?.querySelector("[class*='editor-grid']");
    expect(editorGrid).toBeTruthy();
  });

  it("selecting a borrowed degree cell clears any existing quality override", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, [
        { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "dim", manualRoot: null },
      ]],
      [activeProgressionStepIndexAtom, 0],
    ]);
    renderWithStore(<SongControls />, store);

    // In C Major, D# / Eb is a borrowed (chromatic) cell — not in key
    const degreeGroup = screen.getByRole("group", { name: "Chord root" });
    // Borrowed cells have aria-label pattern: "numeral note" (e.g. "♯ii D#" or "♭iii Eb")
    const borrowedCells = within(degreeGroup)
      .getAllByRole("button")
      .filter((btn) => btn.getAttribute("data-in-key") === "false");
    // Click the first borrowed cell (D#/Eb, offset 3 from C)
    const ebCell = borrowedCells.find((btn) =>
      /d#|eb|d♯|e♭/i.test(btn.getAttribute("aria-label") ?? ""),
    );
    expect(ebCell).toBeTruthy();
    fireEvent.click(ebCell!);

    const step = store.get(progressionStepsAtom)[0];
    expect(step.qualityOverride).toBeNull();
    expect(step.manualRoot).toMatch(/d#|eb/i);
  });
});

describe("Editor grid layout (Plan I-T4)", () => {
  it("editor-grid uses flex (not CSS Grid with 1fr/auto spread)", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const editorGrid = container.querySelector("[class*='editor-grid']");
    expect(editorGrid).toBeTruthy();
    expect(getComputedStyle(editorGrid as Element).display).toBe("flex");
  });
});

describe("SongControls width sweep (Plan H-T3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Root select uses fill width (no data-width='fixed')", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const rootCombos = container.querySelectorAll("[role='combobox']");
    // Root combobox is aria-labelledby a label with text "Root"
    const rootCombo = Array.from(rootCombos).find((el) => {
      const labelledBy = el.getAttribute("aria-labelledby");
      if (!labelledBy) return false;
      const labelEl = container.querySelector(`#${CSS.escape(labelledBy)}`);
      return labelEl?.textContent?.trim() === "Root";
    });
    expect(rootCombo).toBeTruthy();
    expect(rootCombo?.closest("[data-width='fixed']")).toBeNull();
  });

  it("Quality select uses fixed width 9rem", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    // Quality combobox is aria-labelledby a label with text "Quality"
    const allCombos = container.querySelectorAll("[role='combobox']");
    const qualityCombo = Array.from(allCombos).find((el) => {
      const labelledBy = el.getAttribute("aria-labelledby");
      if (!labelledBy) return false;
      const labelEl = container.querySelector(`#${CSS.escape(labelledBy)}`);
      return labelEl?.textContent?.trim() === "Quality";
    });
    expect(qualityCombo).toBeTruthy();
    const wrapper = qualityCombo?.closest("[data-width='fixed']");
    expect(wrapper).toBeTruthy();
    expect((wrapper as HTMLElement).style.getPropertyValue("--labeled-select-width")).toBe("9rem");
  });

  it("Scale select uses fill width (no data-width='fixed')", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const allCombos = container.querySelectorAll("[role='combobox']");
    const scaleCombo = Array.from(allCombos).find((el) => {
      const labelledBy = el.getAttribute("aria-labelledby");
      if (!labelledBy) return false;
      const labelEl = container.querySelector(`#${CSS.escape(labelledBy)}`);
      return labelEl?.textContent?.trim() === "Scale";
    });
    expect(scaleCombo).toBeTruthy();
    expect(scaleCombo?.closest("[data-width='fixed']")).toBeNull();
  });

  it("Preset select uses fill width (no data-width='fixed')", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const allCombos = container.querySelectorAll("[role='combobox']");
    const presetCombo = Array.from(allCombos).find((el) => {
      const labelledBy = el.getAttribute("aria-labelledby");
      if (!labelledBy) return false;
      const labelEl = container.querySelector(`#${CSS.escape(labelledBy)}`);
      return labelEl?.textContent?.trim() === "Preset";
    });
    expect(presetCombo).toBeTruthy();
    expect(presetCombo?.closest("[data-width='fixed']")).toBeNull();
  });
});

describe("SongControls G11b: step-list removal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not render an in-Inspector progression step list (delegated to ProgressionTrack)", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    expect(container.querySelector("[class*='step-list']")).toBeNull();
  });

  it("does not render the 'Chords' group header inside the Inspector", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const matches = screen.queryAllByText(/^chords$/i);
    const groupHeaderMatches = matches.filter(
      (el) => /groupHeader/i.test(el.className) || el.closest("[class*='groupHeader']"),
    );
    expect(groupHeaderMatches.length).toBe(0);
  });
});

describe("Top-row group composer (Plan I-T5)", () => {
  it("wraps KEY + TIME groups in a flex composer container", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const composer = container.querySelector("[class*='groupRow']");
    expect(composer).toBeTruthy();
    expect(getComputedStyle(composer as Element).display).toBe("flex");
    const columns = composer?.querySelectorAll("[class*='groupColumn']");
    expect(columns?.length).toBe(2);
  });

  it("each group column has flex: 1 1 24rem (grow + shrink with sensible basis)", () => {
    const { container } = renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const columns = container.querySelectorAll("[class*='groupColumn']");
    expect(columns.length).toBeGreaterThan(0);
    const styles = getComputedStyle(columns[0]);
    // Computed style for `flex: 1 1 24rem` is usually "1 1 384px" (24*16)
    expect(styles.flex).toMatch(/1\s+1\s+(24rem|384px)/);
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
    // The pill class uses CSS Modules so query by role within the header element.
    // SongControls now nests sections inside InspectorCard <header>s, so target
    // the editor's header specifically by locating the chord label first.
    const editorHeader = container
      .querySelector('[class*="editor-header"]') as HTMLElement | null;
    expect(editorHeader).toBeInTheDocument();
    // Chord label shows the resolved chord name
    expect(within(editorHeader!).getByText("C major")).toBeInTheDocument();
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

  it("renders the static progression hint with highlighted Voicing and lens terms", () => {
    renderWithStore(<SongControls />, makeAtomStore([...BASE_SEEDS]));
    const hint = screen.getByTestId("progression-help-text");
    expect(hint).toHaveTextContent(
      "Voicing & lens for this chord live on the Overlay tab.",
    );
    expect(within(hint).getByText("Voicing")).toHaveClass("progressionHelpStrong");
    expect(within(hint).getByText("lens")).toHaveClass("progressionHelpStrong");
  });
});
