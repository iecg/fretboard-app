// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type CagedShape } from "@fretflow/core";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { practiceLensAtom, voicingAtom } from "../../store/chordOverlayAtoms";
import { fingeringPatternAtom, cagedShapesAtom } from "../../store/fingeringAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { scaleNameAtom, rootNoteAtom } from "../../store/scaleAtoms";
import { ChordOverlayControls } from "./ChordOverlayControls";

/**
 * ChordOverlayControls now owns only the VOICING sub-group (VoicingControl +
 * Lens ToggleBar). SOURCE (Degree + Root) and CHORD TYPE (Quality) have moved
 * to SongControls / the Song-tab progression editor.
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
    { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
  ]],
] as const;

type SeedTuple = readonly [unknown, unknown];

const renderDegree = (extras: ReadonlyArray<SeedTuple> = []) =>
  renderWithAtoms(<ChordOverlayControls />, [...DEGREE_SEEDS, ...extras] as never);
const renderManual = (extras: ReadonlyArray<SeedTuple> = []) =>
  renderWithAtoms(<ChordOverlayControls />, [...MANUAL_SEEDS, ...extras] as never);

// `within(screen.getByRole("group", { name })).getByRole("button", { name })`
// shorthand — the most repeated pattern in this file.
const groupBtn = (groupName: string, btnName: string | RegExp) =>
  within(screen.getByRole("group", { name: groupName })).getByRole("button", { name: btnName });

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

    it("renders a VOICING label above the Voicing dropdown so the row aligns with Lens", () => {
      renderDegree();
      // The Prop's label renders as a visible micro-label in the DOM.
      // Look for the text "Voicing" that appears as a propLabel element.
      const allVoicingLabels = screen.getAllByText("Voicing");
      // At least one should be the Prop label (the micro-label above the dropdown).
      // The propLabel has "propLabel" in its className.
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

  describe("7. lens picker remains functional", () => {
    it("lens ToggleBar is present when chord is active", () => {
      renderDegree();
      expect(screen.getByRole("group", { name: "Practice lens" })).toBeInTheDocument();
    });

    it("lens ToggleBar has a pressed button when a lens is active", () => {
      renderDegree([[practiceLensAtom, "tones"]]);
      // Find a button that is aria-pressed="true" inside the Practice lens group
      const lensGroup = screen.getByRole("group", { name: "Practice lens" });
      const pressedButton = within(lensGroup).getByRole("button", { pressed: true });
      expect(pressedButton).toBeInTheDocument();
    });

    it("renders exactly two lens options: Tones, Lead", () => {
      renderDegree();
      const group = screen.getByRole("group", { name: "Practice lens" });
      const buttons = within(group).getAllByRole("button");
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toHaveTextContent(/tones/i);
      expect(buttons[1]).toHaveTextContent(/lead/i);
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

  describe("12. lens Prop shows static hint", () => {
    it("does not render a lens help-button when chord is active", () => {
      renderDegree();
      expect(
        screen.queryByRole("button", { name: /show help for lens/i }),
      ).not.toBeInTheDocument();
    });

    it("renders the static lens hint with highlighted Tones and Lead terms", () => {
      renderDegree();
      const hint = screen.getByTestId("lens-help-text");
      expect(hint).toHaveTextContent(
        "Tones highlights chord notes with guide-tone (3rd/7th) emphasis. Lead anticipates the next chord.",
      );
      expect(within(hint).getByText("Tones")).toHaveClass("lensHelpStrong");
      expect(within(hint).getByText("Lead")).toHaveClass("lensHelpStrong");
    });

    it("no legacy lens-hint paragraph remains", () => {
      const { container } = renderDegree();
      expect(container.querySelector(".lens-hint")).not.toBeInTheDocument();
    });
  });

  describe("13. group headers order and Lens placement", () => {
    it("renders no group headers (Voicing sub-group header retired)", () => {
      renderManual();
      const headers = screen.queryAllByRole("heading", { level: 3 });
      expect(headers).toHaveLength(0);
    });

    it("places the Lens control after the Voicing combobox in the DOM", () => {
      renderManual();
      const lensLabel = screen.getByText("Lens");
      const voicingCombobox = screen.getByRole("combobox", { name: /voicing/i });
      // Lens label appears after the Voicing combobox in document order.
      expect(
        voicingCombobox.compareDocumentPosition(lensLabel) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
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

    it("renders the string-set picker when voicing is 'close'", () => {
      renderManual([[voicingAtom, "close"]]);
      expect(
        screen.getByRole("combobox", { name: /strings/i }),
      ).toBeInTheDocument();
    });

    it("hides the string-set picker when voicing is 'off' or 'full'", () => {
      const { unmount } = renderManual([[voicingAtom, "off"]]);
      expect(
        screen.queryByRole("combobox", { name: /strings/i }),
      ).not.toBeInTheDocument();
      unmount();

      renderManual([[voicingAtom, "full"]]);
      expect(
        screen.queryByRole("combobox", { name: /strings/i }),
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

  describe("F5h: snap-to-scale toggle", () => {
    it("renders the snap-to-scale switch when fingeringPattern !== 'none'", () => {
      renderManual();
      expect(
        screen.getByRole("switch", { name: /lock to scale/i }),
      ).toBeInTheDocument();
    });

    it("hides the snap-to-scale switch when fingeringPattern === 'none'", () => {
      renderManual([[fingeringPatternAtom, "none"]]);
      expect(
        screen.queryByRole("switch", { name: /lock to scale/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("G7: lock-to-scale toggle disabled for single/double-string patterns", () => {
    it("renders the lock-to-scale toggle disabled when fingeringPattern is one-string", () => {
      renderManual([[fingeringPatternAtom, "one-string"]]);
      const toggle = screen.getByRole("switch", { name: /lock to scale/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toBeDisabled();
    });

    it("renders the lock-to-scale toggle disabled when fingeringPattern is two-strings", () => {
      renderManual([[fingeringPatternAtom, "two-strings"]]);
      const toggle = screen.getByRole("switch", { name: /lock to scale/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toBeDisabled();
    });

    it("renders the lock-to-scale toggle enabled when fingeringPattern is caged", () => {
      renderManual([
        [fingeringPatternAtom, "caged"],
        [cagedShapesAtom, new Set<CagedShape>(["E"])],
      ]);
      const toggle = screen.getByRole("switch", { name: /lock to scale/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).not.toBeDisabled();
    });

    it("renders the lock-to-scale toggle enabled when fingeringPattern is 3nps", () => {
      renderManual([[fingeringPatternAtom, "3nps"]]);
      const toggle = screen.getByRole("switch", { name: /lock to scale/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).not.toBeDisabled();
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
    it.each(["Tones", "Lead"])("Lens toggle includes the %s option", (name) => {
      renderDegree();
      expect(groupBtn("Practice lens", name)).toBeInTheDocument();
    });

    it("both lens options are enabled when chord overlay is active (both only require chord overlay)", () => {
      // C Major triad on degree I — both tones and lead only require hasChordOverlay.
      renderDegree();
      expect(groupBtn("Practice lens", "Tones")).not.toBeDisabled();
      expect(groupBtn("Practice lens", "Lead")).not.toBeDisabled();
    });

    it.each(["Full Chords", "Show on Board"])("no longer renders the %s switch", (name) => {
      renderManual();
      expect(screen.queryByRole("switch", { name })).toBeNull();
    });
  });

  describe("ChordOverlayControls multi-shape CAGED (Plan H-T6)", () => {
    it("renders Lock-to-scale toggle DISABLED when CAGED with multiple shapes selected", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...MANUAL_SEEDS,
        [fingeringPatternAtom, "caged"],
        [cagedShapesAtom, new Set<CagedShape>(["E", "D"])],
      ]);
      const toggle = screen.getByRole("switch", { name: /lock to scale/i });
      expect(toggle).toBeDisabled();
    });

    it("renders Lock-to-scale toggle ENABLED when CAGED with a single shape", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...MANUAL_SEEDS,
        [fingeringPatternAtom, "caged"],
        [cagedShapesAtom, new Set<CagedShape>(["E"])],
      ]);
      const toggle = screen.getByRole("switch", { name: /lock to scale/i });
      expect(toggle).not.toBeDisabled();
    });
  });
});
