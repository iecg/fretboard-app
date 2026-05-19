// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms, renderWithStore, makeAtomStore } from "../../test-utils/renderWithAtoms";
import {
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordQualityOverrideAtom,
  chordRootOverrideAtom,
  progressionStepsAtom,
  scaleNameAtom,
  rootNoteAtom,
  practiceLensAtom,
  fingeringPatternAtom,
  voicingConnectorsAtom,
} from "../../store/atoms";
import { ChordOverlayControls } from "./ChordOverlayControls";

// Expected toggle-bar label order — mirrors CHORD_TYPE_DISPLAY_ORDER mapped through CHORD_TYPE_SHORT_LABELS.
// Kept inline here to avoid importing non-component values from the component file (react-refresh rule).
const EXPECTED_CHORD_TYPE_LABELS = [
  "Maj",
  "min",
  "dim",
  "aug",
  "sus2",
  "sus4",
  "5",
  "M6",
  "m6",
  "M7",
  "m7",
  "7",
  "dim7",
  "m7♭5",
  "mM7",
];

/**
 * Base seeds: C Major scale with degree overlay in degree mode.
 * chordDegreeAtom = "I" causes chordTypeAtom to resolve to "Major Triad",
 * which makes the disclosure open (Boolean(chordType) = true).
 * fingeringPatternAtom = "caged" ensures the chord overlay is not auto-disabled (UAT-16).
 */
const DEGREE_MODE_SEEDS = [
  [scaleNameAtom, "Major"],
  [rootNoteAtom, "C"],
  [chordOverlayModeAtom, "degree"],
  [chordDegreeAtom, "I"],
  [chordQualityOverrideAtom, null],
  [fingeringPatternAtom, "caged"],
  // Empty progression so the manual/degree chord path is the chord source.
  [progressionStepsAtom, []],
] as const;

const MANUAL_MODE_SEEDS = [
  [scaleNameAtom, "Major"],
  [rootNoteAtom, "C"],
  [chordOverlayModeAtom, "manual"],
  [chordQualityOverrideAtom, "Major Triad"],
  [chordRootOverrideAtom, "C"],
  [fingeringPatternAtom, "caged"],
  // Empty progression so the manual/degree chord path is the chord source.
  [progressionStepsAtom, []],
] as const;

describe("ChordOverlayControls/ChordOverlayControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. degree selection writes chordDegreeAtom", () => {
    it("clicking a degree button writes the value", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      const vButton = within(degreeGroup).getByRole("button", { name: "V" });
      await userEvent.click(vButton);
      expect(vButton.getAttribute("aria-pressed")).toBe("true");
    });

    it("switching chord mode to Off deactivates the chord overlay", async () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [chordDegreeAtom, "V"],
      ]);
      const modeGroup = screen.getByRole("group", { name: "Chord overlay mode" });
      await userEvent.click(within(modeGroup).getByRole("button", { name: "Off" }));
      // Degree picker should be hidden when mode is Off
      expect(screen.queryByRole("group", { name: "Chord degree" })).not.toBeInTheDocument();
    });
  });

  describe("2. mode toggle switches chordOverlayModeAtom", () => {
    it("clicking Manual shows NoteGrid and hides degree picker", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      // Degree picker visible initially
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();

      // Click "Manual" toggle button
      await userEvent.click(screen.getByRole("button", { name: "Manual" }));

      // Manual mode: NoteGrid for root picker appears
      expect(screen.getByRole("group", { name: "Note selector" })).toBeInTheDocument();
      // Degree picker gone
      expect(screen.queryByRole("group", { name: "Chord degree" })).not.toBeInTheDocument();
    });

    it("clicking Degree from manual mode brings degree picker back (no degree set hides chord-type toggle bar)", async () => {
      // Seed chordDegreeAtom=null explicitly so the degree-mode chord-type
      // toggle bar is gated off (it only renders when a degree is active).
      renderWithAtoms(<ChordOverlayControls />, [
        ...MANUAL_MODE_SEEDS,
        [chordDegreeAtom, null],
      ]);

      // Manual mode initially: chord-type toggle bar visible (Maj button present)
      expect(screen.getByRole("button", { name: "Maj" })).toBeInTheDocument();

      // Click "Degree" toggle
      await userEvent.click(screen.getByRole("button", { name: "Degree" }));

      // Degree picker visible
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();
      // Without an active degree, the chord-type toggle bar is gated off
      expect(screen.queryByRole("group", { name: "Chord Type" })).not.toBeInTheDocument();
    });

    it("clicking Degree from manual mode preserves chord-type toggle bar when a degree is active", async () => {
      // With an active degree, the chord-type toggle bar appears in degree mode
      // too — letting the user pick a quality (e.g. Dom7) without leaving degree.
      renderWithAtoms(<ChordOverlayControls />, [
        ...MANUAL_MODE_SEEDS,
        [chordDegreeAtom, "V"],
      ]);

      expect(screen.getByRole("button", { name: "Maj" })).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Degree" }));

      // Both the degree picker AND the chord-type toggle bar are visible in degree mode.
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Chord Type" })).toBeInTheDocument();
    });
  });

  describe("3. manual mode renders NoteGrid and chord-type toggle bar", () => {
    it("renders chord-type toggle bar and root note grid in manual mode", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);

      // Chord-type toggle bar present (Maj button visible)
      expect(screen.getByRole("button", { name: "Maj" })).toBeInTheDocument();
      // NoteGrid for root
      expect(screen.getByRole("group", { name: "Note selector" })).toBeInTheDocument();
    });

    it("chord-type toggle bar marks seeded value as pressed (Major Triad → Maj)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      const majButton = within(chordTypeGroup).getByRole("button", { name: "Maj" });
      expect(majButton.getAttribute("aria-pressed")).toBe("true");
    });

    it("selecting a chord type from the toggle bar updates manual mode", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });

      await userEvent.click(within(chordTypeGroup).getByRole("button", { name: "m7" }));

      expect(
        within(chordTypeGroup).getByRole("button", { name: "m7" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });

    it("switching chord mode to Off from manual deactivates the chord overlay", async () => {
      const store = makeAtomStore([...MANUAL_MODE_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);

      const modeGroup = screen.getByRole("group", { name: "Chord overlay mode" });
      await userEvent.click(within(modeGroup).getByRole("button", { name: "Off" }));

      expect(store.get(chordOverlayModeAtom)).toBe("off");
    });
  });

  describe("4. persistence: seeded atom values are reflected in the UI", () => {
    it("seeded chordDegreeAtom='V' marks V button as pressed", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "degree"],
        [chordDegreeAtom, "V"],
        [progressionStepsAtom, []],
      ]);

      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      const vButton = within(degreeGroup).getByRole("button", { name: "V" });
      expect(vButton.getAttribute("aria-pressed")).toBe("true");
    });

    it("seeded manual mode with chordQualityOverride='Major 7th' marks M7 button as pressed", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "manual"],
        [chordQualityOverrideAtom, "Major 7th"],
        [chordRootOverrideAtom, "G"],
        [progressionStepsAtom, []],
      ]);

      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      const m7Button = within(chordTypeGroup).getByRole("button", { name: "M7" });
      expect(m7Button.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("5. degree ToggleBar reflects active selection", () => {
    it("clicking ii selects ii (aria-pressed)", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      const iiButton = within(degreeGroup).getByRole("button", { name: "ii" });
      await userEvent.click(iiButton);
      expect(iiButton.getAttribute("aria-pressed")).toBe("true");
    });

    it("clicking I deselects ii (toggle behavior reflects current value)", async () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [chordDegreeAtom, "ii"],
      ]);
      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      const iButton = within(degreeGroup).getByRole("button", { name: "I" });
      const iiButton = within(degreeGroup).getByRole("button", { name: "ii" });
      expect(iiButton.getAttribute("aria-pressed")).toBe("true");
      await userEvent.click(iButton);
      expect(iButton.getAttribute("aria-pressed")).toBe("true");
      expect(iiButton.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("5b. progression source display", () => {
    it("shows and edits the active progression step in degree controls", async () => {
      const store = makeAtomStore([
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "degree"],
        [chordDegreeAtom, null],
        [chordQualityOverrideAtom, null],
        [fingeringPatternAtom, "caged"],
        [progressionStepsAtom, [
          { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
        ]],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      expect(within(degreeGroup).getByRole("button", { name: "V" })).toHaveAttribute("aria-pressed", "true");

      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      await userEvent.click(within(chordTypeGroup).getByRole("button", { name: "m7" }));

      expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBe("Minor 7th");
      expect(store.get(chordQualityOverrideAtom)).toBeNull();
    });
  });

  describe("6. a11y: no violations in degree mode and manual mode", () => {
    it("degree mode has no a11y violations", async () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(await axe(container)).toHaveNoViolations();
    });

    it("manual mode has no a11y violations", async () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(await axe(container)).toHaveNoViolations();
    });

    it("degree mode has Chord degree group with correct aria-label", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();
    });

    it("Chord overlay mode ToggleBar has correct aria-label", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
    });

    it("degree ToggleBar exposes 7 diatonic degrees (no Off sentinel)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      // I, ii, iii, IV, V, vi, vii° = 7 buttons (Off moved to Chord Mode)
      expect(within(degreeGroup).queryByRole("button", { name: "Off" })).not.toBeInTheDocument();
      expect(within(degreeGroup).getByRole("button", { name: "I" })).toBeInTheDocument();
      expect(within(degreeGroup).getByRole("button", { name: "vii°" })).toBeInTheDocument();
      expect(within(degreeGroup).getAllByRole("button")).toHaveLength(7);
    });
  });

  describe("7. lens picker remains functional", () => {
    it("lens ToggleBar is present when chord is active (degree mode with chordDegree=I)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      // The lens ToggleBar has label="Practice lens"
      expect(screen.getByRole("group", { name: "Practice lens" })).toBeInTheDocument();
    });

    it("lens ToggleBar has a pressed button when a lens is active", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [practiceLensAtom, "targets"],
      ]);

      // Find a button that is aria-pressed="true" inside the Practice lens group
      const lensGroup = screen.getByRole("group", { name: "Practice lens" });
      const pressedButton = within(lensGroup).getByRole("button", { pressed: true });
      expect(pressedButton).toBeInTheDocument();
    });

    it("lens ToggleBar is disabled when no chord is active (overlay off)", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "degree"],
        [chordDegreeAtom, null],
        [progressionStepsAtom, []],
      ]);

      const lensGroup = screen.getByRole("group", { name: "Practice lens" });
      const buttons = within(lensGroup).getAllByRole("button");
      buttons.forEach((btn) => expect(btn).toBeDisabled());
    });
  });

  describe("8. chord-type toggle bar (manual mode)", () => {
    it("renders 'Quality' label in manual mode", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(
        screen.getByText("Quality", { selector: "span[class*='propLabel']" }),
      ).toBeInTheDocument();
    });

    it("renders all 15 chord-type buttons (no Off sentinel) in manual mode", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      // No Off sentinel (moved to Chord Mode)
      expect(within(chordTypeGroup).queryByRole("button", { name: "Off" })).not.toBeInTheDocument();
      // All quality types
      expect(within(chordTypeGroup).getByRole("button", { name: "Maj" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "min" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "dim" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "M7" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "m7" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "7" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "sus4" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "5" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "M6" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "aug" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "sus2" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "m6" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "dim7" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "m7♭5" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "mM7" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getAllByRole("button")).toHaveLength(15);
    });

    it("chord-type buttons appear in CHORD_TYPE_DISPLAY_ORDER order (Maj first)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      const buttons = within(chordTypeGroup).getAllByRole("button");
      EXPECTED_CHORD_TYPE_LABELS.forEach((label, i) => {
        expect(buttons[i]).toHaveAccessibleName(label);
      });
    });

    it("clicking a chord type button marks it as pressed", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      const minBtn = within(chordTypeGroup).getByRole("button", { name: "min" });
      await userEvent.click(minBtn);
      expect(minBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("degree mode: Off button is absent from chord-type toggle bar", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });

      // Off must not appear in the degree-mode chord-type toggle bar
      expect(within(chordTypeGroup).queryByRole("button", { name: "Off" })).not.toBeInTheDocument();
    });

    it("degree mode: resolved diatonic chord-type is highlighted without user interaction", () => {
      // DEGREE_MODE_SEEDS uses degree=I in C Major → diatonic default = Major Triad → Maj button
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });

      // The Maj button should be aria-pressed=true because chordType resolves to "Major Triad"
      expect(within(chordTypeGroup).getByRole("button", { name: "Maj" }).getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("9. card flatten: no redundant outer wrapper", () => {
    it("outer wrapper does not have panel-surface class (card flatten)", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).not.toHaveClass("panel-surface");
      expect(outerDiv).not.toHaveClass("panel-surface--compact");
    });
  });

  describe("10. Mode label and hint (Degree/Manual toggle)", () => {
    it("renders visible 'Mode' label adjacent to the toggle", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByText("Mode")).toBeInTheDocument();
    });

    it("renders a short mode hint", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(
        screen.getByText("Off · Diatonic degree · Free root."),
      ).toBeInTheDocument();
    });

    it("does not render a chord mode help button", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(
        screen.queryByRole("button", { name: /show help for chord mode/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("11. 'Degree' label on degree browser", () => {
    it("renders visible 'Degree' label above the degree browser", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const degreeLabel = screen.getByText("Degree", { selector: "span" });
      expect(degreeLabel).toBeInTheDocument();
    });
  });

  describe("15. panel-level disable on 1/2-string fingering patterns (UAT-17)", () => {
    it("panel root has data-disabled='true' when fingeringPattern is one-string", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "one-string"],
      ]);
      const root = container.firstChild as HTMLElement;
      expect(root).toHaveAttribute("data-disabled", "true");
    });

    it("panel root has data-disabled='true' when fingeringPattern is two-strings", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "two-strings"],
      ]);
      const root = container.firstChild as HTMLElement;
      expect(root).toHaveAttribute("data-disabled", "true");
    });

    it("panel root does not have data-disabled when fingeringPattern is caged", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "caged"],
      ]);
      const root = container.firstChild as HTMLElement;
      expect(root).not.toHaveAttribute("data-disabled");
    });

    it("panel root does not have data-disabled when fingeringPattern is none", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "none"],
      ]);
      const root = container.firstChild as HTMLElement;
      expect(root).not.toHaveAttribute("data-disabled");
    });
  });

  describe("14. auto-disable on 1/2-string fingering patterns (UAT-16)", () => {
    it("Chord Mode buttons are disabled when fingeringPattern is one-string (label shows Disabled)", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "one-string"],
      ]);
      const modeGroup = screen.getByRole("group", { name: "Chord overlay mode" });
      // When auto-disabled, the first button's label switches from "Degree" to "Disabled".
      const disabledButton = within(modeGroup).getByRole("button", { name: "Disabled" });
      const manualButton = within(modeGroup).getByRole("button", { name: "Manual" });
      expect(disabledButton).toBeDisabled();
      expect(manualButton).toBeDisabled();
    });

    it("Chord Mode buttons are disabled when fingeringPattern is two-strings (label shows Disabled)", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "two-strings"],
      ]);
      const modeGroup = screen.getByRole("group", { name: "Chord overlay mode" });
      // When auto-disabled, the first button's label switches from "Degree" to "Disabled".
      const disabledButton = within(modeGroup).getByRole("button", { name: "Disabled" });
      expect(disabledButton).toBeDisabled();
    });

    it("Chord Mode buttons are enabled when fingeringPattern is caged", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "caged"],
      ]);
      const modeGroup = screen.getByRole("group", { name: "Chord overlay mode" });
      const degreeButton = within(modeGroup).getByRole("button", { name: "Degree" });
      const manualButton = within(modeGroup).getByRole("button", { name: "Manual" });
      expect(degreeButton).not.toBeDisabled();
      expect(manualButton).not.toBeDisabled();
    });

    it("UAT-23: first Chord Mode button shows 'Disabled' label on one-string pattern", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "one-string"],
      ]);
      const modeGroup = screen.getByRole("group", { name: "Chord overlay mode" });
      expect(within(modeGroup).getByRole("button", { name: "Disabled" })).toBeInTheDocument();
      // "Disabled" replaces "Off" (the first button) when pattern disables chord overlay
      expect(within(modeGroup).queryByRole("button", { name: "Off" })).not.toBeInTheDocument();
    });

    it("UAT-23: first Chord Mode button shows 'Off' label on caged pattern", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "caged"],
      ]);
      const modeGroup = screen.getByRole("group", { name: "Chord overlay mode" });
      expect(within(modeGroup).getByRole("button", { name: "Off" })).toBeInTheDocument();
      expect(within(modeGroup).queryByRole("button", { name: "Disabled" })).not.toBeInTheDocument();
    });

    it("shows disabled hint when fingeringPattern is one-string", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "one-string"],
      ]);
      expect(
        screen.getByText("Chord overlay disabled for single/two-string patterns."),
      ).toBeInTheDocument();
    });

    it("degree selector is hidden when fingeringPattern is two-strings", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "two-strings"],
      ]);
      // Degree section should not render when pattern-disabled
      expect(screen.queryByRole("group", { name: "Chord degree" })).not.toBeInTheDocument();
    });
  });

  describe("12. lens Prop shows static hint", () => {
    it("does not render a lens help-button when chord is active", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(
        screen.queryByRole("button", { name: /show help for lens/i }),
      ).not.toBeInTheDocument();
    });

    it("renders the static lens hint", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(
        screen.getByText(
          "Landing tones · Tension shows chord notes outside the scale.",
        ),
      ).toBeInTheDocument();
    });

    it("no legacy lens-hint paragraph remains", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(container.querySelector(".lens-hint")).not.toBeInTheDocument();
    });
  });

  describe("13. group headers order and Lens placement", () => {
    it("renders SOURCE, CHORD TYPE and VOICING group headers in order", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...MANUAL_MODE_SEEDS,
      ]);
      const headers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
      expect(headers).toEqual(["Source", "Chord Type", "Voicing"]);
    });

    it("places the Lens control inside the SOURCE group", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...MANUAL_MODE_SEEDS,
      ]);
      const lens = screen.getByText("Lens");
      const sourceHeader = screen.getByRole("heading", { name: "Source" });
      const chordTypeHeader = screen.getByRole("heading", { name: "Chord Type" });
      // Lens sits after the SOURCE header and before the CHORD TYPE header.
      expect(sourceHeader.compareDocumentPosition(lens) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(lens.compareDocumentPosition(chordTypeHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe("16. VOICING group controls (Type, Inversion, String Set)", () => {
    it("renders Type, Inversion and String Set in the VOICING group", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(screen.getByRole("group", { name: "Voicing type" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Voicing inversion" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "String Set" })).toBeInTheDocument();
    });

    it("disables the 3rd inversion for a triad", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...MANUAL_MODE_SEEDS,
        [chordQualityOverrideAtom, "Major Triad"],
      ]);
      expect(screen.getByRole("button", { name: "3rd" })).toBeDisabled();
    });
  });

  describe("17. chord-tab design parity", () => {
    it("Lens toggle shows all three options", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const lens = screen.getByRole("group", { name: "Practice lens" });
      expect(within(lens).getByRole("button", { name: "Chord" })).toBeInTheDocument();
      expect(within(lens).getByRole("button", { name: "Guide" })).toBeInTheDocument();
      expect(within(lens).getByRole("button", { name: "Tension" })).toBeInTheDocument();
    });

    it("Tension lens option is disabled when unavailable", () => {
      // C Major triad on degree I has no outside tones → Tension unavailable.
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const lens = screen.getByRole("group", { name: "Practice lens" });
      expect(within(lens).getByRole("button", { name: "Tension" })).toBeDisabled();
    });

    it("renders the Connectors toggle in the VOICING group and writes voicingConnectorsAtom", async () => {
      const store = makeAtomStore([
        ...MANUAL_MODE_SEEDS,
        [voicingConnectorsAtom, false],
      ]);
      renderWithStore(<ChordOverlayControls />, store);
      const toggle = screen.getByRole("switch", { name: "Connectors" });
      expect(toggle).toBeInTheDocument();
      expect(store.get(voicingConnectorsAtom)).toBe(false);
      await userEvent.click(toggle);
      expect(store.get(voicingConnectorsAtom)).toBe(true);
    });

    it("no longer renders the Full Chords or Show on Board switches", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(screen.queryByRole("switch", { name: "Full Chords" })).toBeNull();
      expect(screen.queryByRole("switch", { name: "Show on Board" })).toBeNull();
    });

    it("shows hints for the voicing Type, Inversion and String Set controls", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(
        screen.getByText("How densely the chord is voiced."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Which chord tone is the lowest note."),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Full CAGED uses all six strings — pick a subset for partial voicings.",
        ),
      ).toBeInTheDocument();
    });
  });
});
