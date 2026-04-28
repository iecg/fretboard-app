// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
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

const CHORD_OPTION_VALUES = [
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  "Power Chord (5)",
];

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
    it("selecting a degree via LabeledSelect updates the displayed value", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      const degreeSelect = screen.getByRole("combobox", { name: "Chord Degree" });
      expect(degreeSelect).toBeInTheDocument();

      await userEvent.selectOptions(degreeSelect, "V");
      expect((degreeSelect as HTMLSelectElement).value).toBe("V");
    });

    it("Off option sets displayed value to the Off sentinel", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const degreeSelect = screen.getByRole("combobox", { name: "Chord Degree" });
      await userEvent.selectOptions(degreeSelect, "__none__");
      expect((degreeSelect as HTMLSelectElement).value).toBe("__none__");
    });
  });

  describe("2. mode toggle switches chordOverlayModeAtom", () => {
    it("clicking Manual shows NoteGrid and hides degree browser", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      // Degree browser visible initially
      expect(screen.getByRole("group", { name: "Browse chord degrees" })).toBeInTheDocument();

      // Click "Manual" toggle button
      await userEvent.click(screen.getByRole("button", { name: "Manual" }));

      // Manual mode: NoteGrid for root picker appears
      expect(screen.getByRole("group", { name: "Note selector" })).toBeInTheDocument();
      // Degree browser gone
      expect(screen.queryByRole("group", { name: "Browse chord degrees" })).not.toBeInTheDocument();
    });

    it("clicking Degree from manual mode brings degree browser back", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);

      // Manual mode initially: chord-type nav browser and root note grid visible
      expect(screen.getByRole("group", { name: "Browse chord types" })).toBeInTheDocument();

      // Click "Degree" toggle
      await userEvent.click(screen.getByRole("button", { name: "Degree" }));

      // Degree browser visible
      expect(screen.getByRole("group", { name: "Browse chord degrees" })).toBeInTheDocument();
      // Chord type browser gone
      expect(screen.queryByRole("group", { name: "Browse chord types" })).not.toBeInTheDocument();
    });
  });

  describe("3. manual mode renders NoteGrid and chord-type nav browser", () => {
    it("renders chord-type nav browser and root note grid in manual mode", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);

      // Chord-type nav browser
      expect(screen.getByRole("group", { name: "Browse chord types" })).toBeInTheDocument();
      // NoteGrid for root
      expect(screen.getByRole("group", { name: "Note selector" })).toBeInTheDocument();
    });

    it("chord-type browser displays current value (Major Triad)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const browser = screen.getByRole("group", { name: "Browse chord types" });
      expect(within(browser).getByText("Major Triad")).toBeInTheDocument();
    });
  });

  describe("4. persistence: seeded atom values are reflected in the UI", () => {
    it("seeded chordDegreeAtom='V' shows V in degree select", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "degree"],
        [chordDegreeAtom, "V"],
      ]);

      const degreeSelect = screen.getByRole("combobox", { name: "Chord Degree" });
      expect((degreeSelect as HTMLSelectElement).value).toBe("V");
    });

    it("seeded manual mode with chordQualityOverride='Major 7th' shows correct value in browser", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "manual"],
        [chordQualityOverrideAtom, "Major 7th"],
        [chordRootOverrideAtom, "G"],
      ]);

      const browser = screen.getByRole("group", { name: "Browse chord types" });
      expect(within(browser).getByText("Major 7th")).toBeInTheDocument();
    });
  });

  describe("5. step buttons advance and wrap chordDegreeAtom", () => {
    it("clicking Next advances from I to ii", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      const nextBtn = screen.getByRole("button", { name: "Next chord degree" });
      await userEvent.click(nextBtn);

      const degreeSelect = screen.getByRole("combobox", { name: "Chord Degree" });
      expect((degreeSelect as HTMLSelectElement).value).toBe("ii");
    });

    it("clicking Previous from I wraps to vii°", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      const prevBtn = screen.getByRole("button", { name: "Previous chord degree" });
      await userEvent.click(prevBtn);

      const degreeSelect = screen.getByRole("combobox", { name: "Chord Degree" });
      expect((degreeSelect as HTMLSelectElement).value).toBe("vii°");
    });

    it("stepping forward from I then back returns to I", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);

      const nextBtn = screen.getByRole("button", { name: "Next chord degree" });
      const prevBtn = screen.getByRole("button", { name: "Previous chord degree" });

      await userEvent.click(nextBtn); // I -> ii
      await userEvent.click(prevBtn); // ii -> I

      const degreeSelect = screen.getByRole("combobox", { name: "Chord Degree" });
      expect((degreeSelect as HTMLSelectElement).value).toBe("I");
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

    it("degree mode has Browse chord degrees group with correct aria-label", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByRole("group", { name: "Browse chord degrees" })).toBeInTheDocument();
    });

    it("Chord overlay mode ToggleBar has correct aria-label", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
    });

    it("chevron buttons have expected aria-labels", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByRole("button", { name: "Previous chord degree" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next chord degree" })).toBeInTheDocument();
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

    it("lens ToggleBar is absent when no chord is active (overlay off)", async () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "degree"],
        [chordDegreeAtom, null],
      ]);

      // Click the disclosure button to open the panel
      const disclosureBtn = screen.getByRole("button", { name: /chord overlay/i });
      await act(async () => {
        await userEvent.click(disclosureBtn);
      });

      // No lens ToggleBar when chord is off
      expect(screen.queryByRole("group", { name: "Practice lens" })).not.toBeInTheDocument();
    });
  });

  describe("8. chord-type theory-nav browser (manual mode)", () => {
    it("renders 'Chord Type' label in manual mode", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const labels = container.querySelectorAll(".section-label");
      const chordTypeLabel = Array.from(labels).find((el) => el.textContent === "Chord Type");
      expect(chordTypeLabel).toBeInTheDocument();
    });

    it("renders Prev and Next chord type buttons", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(screen.getByRole("button", { name: "Previous chord type" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next chord type" })).toBeInTheDocument();
    });

    it("clicking Next advances to the next chord type", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      const nextBtn = screen.getByRole("button", { name: "Next chord type" });
      await userEvent.click(nextBtn);
      const browser = screen.getByRole("group", { name: "Browse chord types" });
      expect(within(browser).getByText(CHORD_OPTION_VALUES[1])).toBeInTheDocument();
    });

    it("clicking Prev from first chord type wraps to last (Power Chord (5))", async () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "manual"],
        [chordQualityOverrideAtom, CHORD_OPTION_VALUES[0]],
        [chordRootOverrideAtom, "C"],
      ]);
      const prevBtn = screen.getByRole("button", { name: "Previous chord type" });
      await userEvent.click(prevBtn);
      const browser = screen.getByRole("group", { name: "Browse chord types" });
      expect(
        within(browser).getByText(CHORD_OPTION_VALUES[CHORD_OPTION_VALUES.length - 1]),
      ).toBeInTheDocument();
    });

    it("clicking Next from last chord type wraps to first (Major Triad)", async () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "manual"],
        [chordQualityOverrideAtom, CHORD_OPTION_VALUES[CHORD_OPTION_VALUES.length - 1]],
        [chordRootOverrideAtom, "C"],
      ]);
      const nextBtn = screen.getByRole("button", { name: "Next chord type" });
      await userEvent.click(nextBtn);
      const browser = screen.getByRole("group", { name: "Browse chord types" });
      expect(within(browser).getByText(CHORD_OPTION_VALUES[0])).toBeInTheDocument();
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

  describe("10. Mode label and help-button (Degree/Manual toggle)", () => {
    it("renders visible 'Chord Mode' label adjacent to the toggle", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByText("Chord Mode")).toBeInTheDocument();
    });

    it("renders help-button for mode toggle", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByRole("button", { name: /show help for chord mode/i })).toBeInTheDocument();
    });

    it("clicking mode help-button opens popover with degree/manual explanation", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const helpBtn = screen.getByRole("button", { name: /show help for chord mode/i });
      await userEvent.click(helpBtn);
      expect(screen.getByText(/diatonic chord that follows the active scale/i)).toBeInTheDocument();
      expect(screen.getByText(/free chord root and quality/i)).toBeInTheDocument();
    });

    it("clicking mode help-button again closes popover", async () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const helpBtn = screen.getByRole("button", { name: /show help for chord mode/i });
      await userEvent.click(helpBtn);
      await userEvent.click(helpBtn);
      expect(screen.queryByText(/diatonic chord that follows the active scale/i)).not.toBeInTheDocument();
    });
  });

  describe("11. 'Degree' label on degree browser", () => {
    it("renders visible 'Degree' label above the degree browser", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const labels = container.querySelectorAll(".section-label");
      const degreeLabel = Array.from(labels).find((el) => el.textContent === "Degree");
      expect(degreeLabel).toBeInTheDocument();
    });
  });

  describe("12. lens help-button uses LENS_REGISTRY description", () => {
    it("renders lens help-button when chord is active", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(screen.getByRole("button", { name: /show help for lens/i })).toBeInTheDocument();
    });

    it("clicking lens help-button shows LENS_REGISTRY description for active lens", async () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [practiceLensAtom, "targets"],
      ]);
      const targetsDescription = LENS_REGISTRY.find((r) => r.id === "targets")?.description ?? "";
      expect(targetsDescription).not.toBe("");

      const helpBtn = screen.getByRole("button", { name: /show help for lens/i });
      await userEvent.click(helpBtn);
      expect(screen.getByText(targetsDescription)).toBeInTheDocument();
    });

    it("lens help popover text updates when active lens changes", async () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [practiceLensAtom, "targets"],
      ]);
      const helpBtn = screen.getByRole("button", { name: /show help for lens/i });
      await userEvent.click(helpBtn);
      const targetsDesc = LENS_REGISTRY.find((r) => r.id === "targets")?.description ?? "";
      expect(screen.getByText(targetsDesc)).toBeInTheDocument();
    });

    it("no inline lens-hint paragraph (replaced by help-button)", () => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(container.querySelector(".lens-hint")).not.toBeInTheDocument();
    });
  });
});
