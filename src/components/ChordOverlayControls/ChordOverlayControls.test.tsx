// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms, renderWithStore, makeAtomStore } from "../../test-utils/renderWithAtoms";
import { act } from "react";
import { LENS_REGISTRY } from "../../core/theory";
import {
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordQualityOverrideAtom,
  chordRootOverrideAtom,
  scaleNameAtom,
  rootNoteAtom,
  practiceLensAtom,
} from "../../store/atoms";
import { ChordOverlayControls } from "./ChordOverlayControls";

/**
 * Base seeds: C Major scale with degree overlay in degree mode.
 * chordDegreeAtom = "I" causes chordTypeAtom to resolve to "Major Triad",
 * which makes the disclosure open (Boolean(chordType) = true).
 */
const DEGREE_MODE_SEEDS = [
  [scaleNameAtom, "Major"],
  [rootNoteAtom, "C"],
  [chordOverlayModeAtom, "degree"],
  [chordDegreeAtom, "I"],
] as const;

const MANUAL_MODE_SEEDS = [
  [scaleNameAtom, "Major"],
  [rootNoteAtom, "C"],
  [chordOverlayModeAtom, "manual"],
  [chordQualityOverrideAtom, "Major Triad"],
  [chordRootOverrideAtom, "C"],
] as const;

describe("ChordOverlayControls/ChordOverlayControls", () => {
  describe("1. degree selection writes chordDegreeAtom", () => {
    it("clicking a degree button writes the value", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      const vButton = within(degreeGroup).getByRole("button", { name: "V" });
      await userEvent.click(vButton);
      expect(vButton.getAttribute("aria-pressed")).toBe("true");
    });

    it("clicking Off sets the value to the Off sentinel", async () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [chordDegreeAtom, "V"],
      ]);
      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      const offButton = within(degreeGroup).getByRole("button", { name: "Off" });
      await userEvent.click(offButton);
      expect(offButton.getAttribute("aria-pressed")).toBe("true");
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

    it("clicking Off clears chordQualityOverride to null", async () => {
      const store = makeAtomStore([...MANUAL_MODE_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });

      await userEvent.click(within(chordTypeGroup).getByRole("button", { name: "Off" }));

      expect(store.get(chordQualityOverrideAtom)).toBeNull();
    });
  });

  describe("4. persistence: seeded atom values are reflected in the UI", () => {
    it("seeded chordDegreeAtom='V' marks V button as pressed", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "degree"],
        [chordDegreeAtom, "V"],
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

    it("degree ToggleBar exposes Off + 7 diatonic degrees", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      // Off + I, ii, iii, IV, V, vi, vii° = 8 buttons
      expect(within(degreeGroup).getByRole("button", { name: "Off" })).toBeInTheDocument();
      expect(within(degreeGroup).getByRole("button", { name: "I" })).toBeInTheDocument();
      expect(within(degreeGroup).getByRole("button", { name: "vii°" })).toBeInTheDocument();
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

    it("lens ToggleBar is absent when no chord is active (overlay off)", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "degree"],
        [chordDegreeAtom, null],
      ]);

      expect(screen.queryByRole("group", { name: "Practice lens" })).not.toBeInTheDocument();
    });
  });

  describe("8. chord-type toggle bar (manual mode)", () => {
    it("renders 'Chord Type' label in manual mode", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const labels = container.querySelectorAll(".section-label");
      const chordTypeLabel = Array.from(labels).find((el) => el.textContent === "Chord Type");
      expect(chordTypeLabel).toBeInTheDocument();
    });

    it("renders all 10 chord-type buttons (Off + 9 types) in manual mode", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      expect(within(chordTypeGroup).getByRole("button", { name: "Off" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "Maj" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "min" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "dim" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "6" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "M7" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "m7" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "7" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "sus4" })).toBeInTheDocument();
      expect(within(chordTypeGroup).getByRole("button", { name: "5" })).toBeInTheDocument();
    });

    it("clicking a chord type button marks it as pressed", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      const minBtn = within(chordTypeGroup).getByRole("button", { name: "min" });
      await userEvent.click(minBtn);
      expect(minBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("Off is leftmost — Off button appears before Maj in DOM order", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      const buttons = within(chordTypeGroup).getAllByRole("button");
      expect(buttons[0]).toHaveAccessibleName("Off");
      expect(buttons[1]).toHaveAccessibleName("Maj");
    });

    it("clicking Off clears chordQualityOverride to null (degree mode)", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });

      // First select a chord type so something is active
      await userEvent.click(within(chordTypeGroup).getByRole("button", { name: "M7" }));
      // Then click Off
      await userEvent.click(within(chordTypeGroup).getByRole("button", { name: "Off" }));

      expect(within(chordTypeGroup).getByRole("button", { name: "Off" }).getAttribute("aria-pressed")).toBe("true");
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
    it("renders visible 'Chord Mode' label adjacent to the toggle", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByText("Chord Mode")).toBeInTheDocument();
    });

    it("renders a short mode hint", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(
        screen.getByText("Picks a chord by scale degree — diatonic to the key."),
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

  describe("13. compact prop forwarding", () => {
    it("forwards compact=true to StepperSelect instances in degree mode (data-compact present)", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls compact />, [...DEGREE_MODE_SEEDS]);
      const compactGroups = container.querySelectorAll('[data-compact="true"]');
      expect(compactGroups.length).toBeGreaterThan(0);
    });

    it("forwards compact=true to StepperSelect instances in manual mode (data-compact present)", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls compact />, [...MANUAL_MODE_SEEDS]);
      const compactGroups = container.querySelectorAll('[data-compact="true"]');
      expect(compactGroups.length).toBeGreaterThan(0);
    });

    it("does not set data-compact when compact prop is omitted", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const compactGroups = container.querySelectorAll('[data-compact="true"]');
      expect(compactGroups.length).toBe(0);
    });
  });

  describe("12. lens hint uses LENS_REGISTRY description", () => {
    it("does not render a lens help-button when chord is active", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(
        screen.queryByRole("button", { name: /show help for lens/i }),
      ).not.toBeInTheDocument();
    });

    it("shows LENS_REGISTRY description for active lens", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [practiceLensAtom, "targets"],
      ]);
      const targetsDescription = LENS_REGISTRY.find((r) => r.id === "targets")?.description ?? "";
      expect(targetsDescription).not.toBe("");

      expect(screen.getByText(targetsDescription)).toBeInTheDocument();
    });

    it("lens hint text updates when active lens changes", () => {
      const store = makeAtomStore([
        ...DEGREE_MODE_SEEDS,
        [practiceLensAtom, "targets"],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

      const targetsDesc = LENS_REGISTRY.find((r) => r.id === "targets")?.description ?? "";
      const guideDesc = LENS_REGISTRY.find((r) => r.id === "guide-tones")?.description ?? "";
      expect(targetsDesc).not.toBe("");
      expect(guideDesc).not.toBe("");
      expect(guideDesc).not.toBe(targetsDesc);

      expect(screen.getByText(targetsDesc)).toBeInTheDocument();

      act(() => {
        store.set(practiceLensAtom, "guide-tones");
      });

      expect(screen.getByText(guideDesc)).toBeInTheDocument();
      expect(screen.queryByText(targetsDesc)).not.toBeInTheDocument();
    });

    it("no legacy lens-hint paragraph remains", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(container.querySelector(".lens-hint")).not.toBeInTheDocument();
    });
  });
});
