// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { type CagedShape } from "@fretflow/core";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms, renderWithStore } from "../../test-utils/renderWithAtoms";
import { voicingAtom } from "../../store/chordOverlayAtoms";
import { fingeringPatternAtom, cagedShapesAtom } from "../../store/fingeringAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { scaleNameAtom, rootNoteAtom } from "../../store/scaleAtoms";
import { ChordOverlayControls } from "./ChordOverlayControls";

/**
 * ChordOverlayControls now owns only the VOICING sub-group (VoicingControl +
 * optional ChordStringSetToggleBar). The Lens picker has been removed.
 *
 * Default seeds: C Major, one progression step at degree I (= Major Triad).
 * `fingeringPatternAtom = "caged"` keeps the overlay enabled.
 */
const DEGREE_SEEDS = [
  [scaleNameAtom, "major"],
  [rootNoteAtom, "C"],
  [fingeringPatternAtom, "caged"],
  [progressionStepsAtom, [
    { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  ]],
] as const;

const MANUAL_SEEDS = [
  [scaleNameAtom, "major"],
  [rootNoteAtom, "C"],
  [fingeringPatternAtom, "caged"],
  [progressionStepsAtom, [
    { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "M", manualRoot: "C" },
  ]],
] as const;

type SeedTuple = readonly [unknown, unknown];

const renderDegree = (extras: ReadonlyArray<SeedTuple> = []) =>
  renderWithAtoms(<ChordOverlayControls />, [...DEGREE_SEEDS, ...extras] as never);
const renderManual = (extras: ReadonlyArray<SeedTuple> = []) =>
  renderWithAtoms(<ChordOverlayControls />, [...MANUAL_SEEDS, ...extras] as never);

describe("ChordOverlayControls/ChordOverlayControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("a11y + group labels", () => {
    it.each([
      { label: "diatonic step", seeds: DEGREE_SEEDS },
      { label: "manual step", seeds: MANUAL_SEEDS },
    ])("$label has no a11y violations", async ({ seeds }) => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...seeds]);
      expect(await axe(container)).toHaveNoViolations();
    });

    it("renders no group headers (Voicing sub-group header removed; section header lives in the parent tab)", () => {
      renderDegree();
      const headers = screen.queryAllByRole("heading", { level: 3 });
      expect(headers).toHaveLength(0);
    });

    it("renders a VOICING label above the Voicing dropdown", () => {
      renderDegree();
      const allVoicingLabels = screen.getAllByText("Voicing");
      const propLabel = allVoicingLabels.find((el) => /propLabel/i.test(el.className));
      expect(propLabel).toBeDefined();
    });

    it("does not render Degree picker or Root picker (moved to SongControls)", () => {
      renderDegree();
      expect(screen.queryByRole("group", { name: "Chord degree" })).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Note selector" })).not.toBeInTheDocument();
    });

    it("does not render the chord-type grid (moved to SongControls)", () => {
      renderDegree();
      expect(screen.queryByRole("group", { name: "Chord Type" })).not.toBeInTheDocument();
    });
  });

  describe("Lens removal", () => {
    it("does not render a Lens control", () => {
      renderDegree();
      expect(screen.queryByRole("group", { name: /lens/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Tones/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Lead/i)).not.toBeInTheDocument();
    });
  });

  describe("9. card flatten: no redundant outer wrapper", () => {
    it("outer wrapper does not have panel-surface class (card flatten)", () => {
      const { container } = renderDegree();
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).not.toHaveClass("panel-surface");
      expect(outerDiv).not.toHaveClass("panel-surface--compact");
    });
  });

  describe("13. group headers order", () => {
    it("renders no group headers (Voicing sub-group header retired)", () => {
      renderManual();
      const headers = screen.queryAllByRole("heading", { level: 3 });
      expect(headers).toHaveLength(0);
    });
  });

  describe("Voicing group (v2.0 single dropdown)", () => {
    it("renders the Voicing dropdown as a combobox with three options (Off/Full/Close)", async () => {
      renderManual();
      const combobox = screen.getByRole("combobox", { name: /voicing/i });
      expect(combobox).toBeInTheDocument();
      await userEvent.click(combobox);
      expect(screen.getByRole("option", { name: /Off/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Full/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Close/i })).toBeInTheDocument();
    });

    it("does not render the legacy numeric Close position picker", () => {
      renderManual([[voicingAtom, "close"]]);
      expect(screen.queryByTestId("close-position-picker")).not.toBeInTheDocument();
    });

    it("renders the string-set toggle bar (not a dropdown) when voicing is 'close'", () => {
      renderManual([[voicingAtom, "close"]]);
      // New behavior: toggle bar (role=group) not dropdown (role=combobox)
      expect(
        screen.getByRole("group", { name: /strings/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: /strings/i })).not.toBeInTheDocument();
    });

    it("hides the string-set control when voicing is 'off' or 'full'", () => {
      const { unmount } = renderManual([[voicingAtom, "off"]]);
      expect(
        screen.queryByRole("group", { name: /strings/i }),
      ).not.toBeInTheDocument();
      unmount();

      renderManual([[voicingAtom, "full"], [fingeringPatternAtom, "none"]]);
      expect(
        screen.queryByRole("group", { name: /strings/i }),
      ).not.toBeInTheDocument();
    });

    it("does not render legacy Type/Inversion/Connectors controls", () => {
      renderManual([[voicingAtom, "full"]]);
      expect(screen.queryByRole("group", { name: "Voicing type" })).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Voicing inversion" })).not.toBeInTheDocument();
      expect(screen.queryByRole("switch", { name: "Connectors" })).not.toBeInTheDocument();
    });

    it("does not render the legacy Region toggle bar", () => {
      renderManual();
      expect(screen.queryByRole("group", { name: /^region$/i })).not.toBeInTheDocument();
    });
  });

  describe("Task 3.6: per-tab visibility switches", () => {
    it("does not render a visibility switch (moved to ViewTab group header)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_SEEDS]);
      expect(screen.queryByRole("switch", { name: /chord layer/i })).not.toBeInTheDocument();
    });
  });

  describe("Task 4: controls always enabled regardless of fingering pattern", () => {
    const PATTERNS = ["one-string", "two-strings", "caged", "none"] as const;

    it.each(PATTERNS)("panel root has no data-disabled when fingeringPattern is %s", (pattern) => {
      const { container } = renderDegree([[fingeringPatternAtom, pattern]]);
      expect(container.firstChild as HTMLElement).not.toHaveAttribute("data-disabled");
    });
  });

  describe("ChordOverlayControls grid layout (Plan H-T4)", () => {
    it("renders the chord row as a 12-column PropGrid", () => {
      const { container } = renderDegree();
      const grid = container.querySelector("[data-columns]");
      expect(grid?.getAttribute("data-columns")).toBe("12");
    });
  });

  describe("17. chord-tab design parity", () => {
    it.each(["Full Chords", "Show on Board"])("no longer renders the %s switch", (name) => {
      renderManual();
      expect(screen.queryByRole("switch", { name })).toBeNull();
    });
  });

});

describe("ChordOverlayControls — string-set picker render gate", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the toggle bar in close mode with an active chord", () => {
    const store = createStore();
    store.set(voicingAtom, "close");
    store.set(scaleNameAtom, "major");
    store.set(rootNoteAtom, "C");
    store.set(progressionStepsAtom, [
      { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "M", manualRoot: "C" },
    ]);
    renderWithStore(<ChordOverlayControls />, store);
    expect(screen.getByRole("group", { name: /strings/i })).toBeInTheDocument();
    // Specifically the new toggle bar (buttons, not a select for strings)
    expect(screen.queryByRole("combobox", { name: /strings/i })).not.toBeInTheDocument();
  });

  it("does NOT render the picker in full mode even when hasFallback is true", () => {
    const store = createStore();
    store.set(voicingAtom, "full");
    store.set(fingeringPatternAtom, "caged");
    store.set(cagedShapesAtom, new Set<CagedShape>(["C"]));
    store.set(scaleNameAtom, "major");
    store.set(rootNoteAtom, "B");
    store.set(progressionStepsAtom, [
      { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "dim", manualRoot: "B" },
    ]);
    renderWithStore(<ChordOverlayControls />, store);
    expect(screen.queryByRole("group", { name: /strings/i })).not.toBeInTheDocument();
  });

  it("does NOT render the picker when no chord is active", () => {
    const store = createStore();
    store.set(voicingAtom, "close");
    store.set(progressionStepsAtom, []);
    renderWithStore(<ChordOverlayControls />, store);
    expect(screen.queryByRole("group", { name: /strings/i })).not.toBeInTheDocument();
  });
});
