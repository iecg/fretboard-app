// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { act } from "@testing-library/react";
import { renderWithAtoms, renderWithStore, makeAtomStore } from "../../test-utils/renderWithAtoms";
import { chordDegreeAtom, chordOverlayModeAtom, chordQualityOverrideAtom, chordRootOverrideAtom, practiceLensAtom, voicingConnectorsAtom, voicingTypeAtom, voicingStringSetAtom, voicingInversionAtom } from "../../store/chordOverlayAtoms";
import { voicingSectionExpandedAtom } from "../../store/chordScope";
import { fingeringPatternAtom, cagedShapesAtom } from "../../store/fingeringAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { scaleNameAtom, rootNoteAtom } from "../../store/scaleAtoms";
import { validVoicingCombosAtom, controlRecencyAtom, noteControlChangeAtom } from "../../store/voicingCoupling";
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

type SeedTuple = readonly [unknown, unknown];

const renderDegree = (extras: ReadonlyArray<SeedTuple> = []) =>
  renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS, ...extras] as never);
const renderManual = (extras: ReadonlyArray<SeedTuple> = []) =>
  renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS, ...extras] as never);

// `within(screen.getByRole("group", { name })).getByRole("button", { name })`
// shorthand — the most repeated pattern in this file.
const groupBtn = (groupName: string, btnName: string | RegExp) =>
  within(screen.getByRole("group", { name: groupName })).getByRole("button", { name: btnName });
const queryGroupBtn = (groupName: string, btnName: string | RegExp) =>
  within(screen.getByRole("group", { name: groupName })).queryByRole("button", { name: btnName });

describe("ChordOverlayControls/ChordOverlayControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. degree selection writes chordDegreeAtom", () => {
    it("clicking a degree button writes the value", async () => {
      renderDegree();
      const v = groupBtn("Chord degree", "V");
      await userEvent.click(v);
      expect(v.getAttribute("aria-pressed")).toBe("true");
    });

    it("switching chord mode to Off deactivates the chord overlay", async () => {
      renderDegree([[chordDegreeAtom, "V"]]);
      await userEvent.click(groupBtn("Chord overlay mode", "Off"));
      expect(screen.queryByRole("group", { name: "Chord degree" })).not.toBeInTheDocument();
    });
  });

  describe("2. mode toggle switches chordOverlayModeAtom", () => {
    it("clicking Manual shows NoteGrid and hides degree picker", async () => {
      renderDegree();
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Manual" }));
      expect(screen.getByRole("group", { name: "Note selector" })).toBeInTheDocument();
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
      renderManual([[chordDegreeAtom, "V"]]);
      expect(screen.getByRole("button", { name: "Maj" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Degree" }));
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Chord Type" })).toBeInTheDocument();
    });
  });

  describe("3. manual mode renders NoteGrid and chord-type toggle bar", () => {
    it("renders chord-type toggle bar and root note grid in manual mode", () => {
      renderManual();
      expect(screen.getByRole("button", { name: "Maj" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Note selector" })).toBeInTheDocument();
    });

    it("chord-type toggle bar marks seeded value as pressed (Major Triad → Maj)", () => {
      renderManual();
      expect(groupBtn("Chord Type", "Maj").getAttribute("aria-pressed")).toBe("true");
    });

    it("selecting a chord type from the toggle bar updates manual mode", async () => {
      renderManual();
      await userEvent.click(groupBtn("Chord Type", "m7"));
      expect(groupBtn("Chord Type", "m7").getAttribute("aria-pressed")).toBe("true");
    });

    it("switching chord mode to Off from manual deactivates the chord overlay", async () => {
      const store = makeAtomStore([...MANUAL_MODE_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      await userEvent.click(groupBtn("Chord overlay mode", "Off"));
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
      expect(groupBtn("Chord degree", "V").getAttribute("aria-pressed")).toBe("true");
    });

    it("seeded manual mode with chordQualityOverride='Major 7th' marks M7 button as pressed", () => {
      renderManual([[chordQualityOverrideAtom, "Major 7th"], [chordRootOverrideAtom, "G"]]);
      expect(groupBtn("Chord Type", "M7").getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("5. degree ToggleBar reflects active selection", () => {
    it("clicking ii selects ii (aria-pressed)", async () => {
      renderDegree();
      const ii = groupBtn("Chord degree", "ii");
      await userEvent.click(ii);
      expect(ii.getAttribute("aria-pressed")).toBe("true");
    });

    it("clicking I deselects ii (toggle behavior reflects current value)", async () => {
      renderDegree([[chordDegreeAtom, "ii"]]);
      const i = groupBtn("Chord degree", "I");
      const ii = groupBtn("Chord degree", "ii");
      expect(ii.getAttribute("aria-pressed")).toBe("true");
      await userEvent.click(i);
      expect(i.getAttribute("aria-pressed")).toBe("true");
      expect(ii.getAttribute("aria-pressed")).toBe("false");
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
      expect(groupBtn("Chord degree", "V")).toHaveAttribute("aria-pressed", "true");
      await userEvent.click(groupBtn("Chord Type", "m7"));
      expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBe("Minor 7th");
      expect(store.get(chordQualityOverrideAtom)).toBeNull();
    });
  });

  describe("a11y + group labels", () => {
    it.each([
      { label: "degree mode", seeds: DEGREE_MODE_SEEDS },
      { label: "manual mode", seeds: MANUAL_MODE_SEEDS },
    ])("$label has no a11y violations", async ({ seeds }) => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...seeds]);
      expect(await axe(container)).toHaveNoViolations();
    });

    it("degree mode exposes the expected group labels and 7 diatonic degrees", () => {
      renderDegree();
      expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      expect(within(degreeGroup).queryByRole("button", { name: "Off" })).not.toBeInTheDocument();
      expect(within(degreeGroup).getByRole("button", { name: "I" })).toBeInTheDocument();
      expect(within(degreeGroup).getByRole("button", { name: "vii°" })).toBeInTheDocument();
      expect(within(degreeGroup).getAllByRole("button")).toHaveLength(7);
    });
  });

  describe("7. lens picker remains functional", () => {
    it("lens ToggleBar is present when chord is active (degree mode with chordDegree=I)", () => {
      renderDegree();
      expect(screen.getByRole("group", { name: "Practice lens" })).toBeInTheDocument();
    });

    it("lens ToggleBar has a pressed button when a lens is active", () => {
      renderDegree([[practiceLensAtom, "targets"]]);
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
      renderManual();
      expect(screen.getByText("Quality", { selector: "span[class*='propLabel']" })).toBeInTheDocument();
    });

    it("renders all 15 chord-type buttons in CHORD_TYPE_DISPLAY_ORDER (no Off sentinel)", () => {
      renderManual();
      const chordTypeGroup = screen.getByRole("group", { name: "Chord Type" });
      expect(within(chordTypeGroup).queryByRole("button", { name: "Off" })).not.toBeInTheDocument();
      const buttons = within(chordTypeGroup).getAllByRole("button");
      expect(buttons).toHaveLength(EXPECTED_CHORD_TYPE_LABELS.length);
      EXPECTED_CHORD_TYPE_LABELS.forEach((label, i) => expect(buttons[i]).toHaveAccessibleName(label));
    });

    it("clicking a chord type button marks it as pressed", async () => {
      renderManual();
      const min = groupBtn("Chord Type", "min");
      await userEvent.click(min);
      expect(min.getAttribute("aria-pressed")).toBe("true");
    });

    it("degree mode: Off button is absent from chord-type toggle bar", () => {
      renderDegree();
      expect(queryGroupBtn("Chord Type", "Off")).not.toBeInTheDocument();
    });

    it("degree mode: resolved diatonic chord-type is highlighted without user interaction", () => {
      // DEGREE_MODE_SEEDS uses degree=I in C Major → diatonic default = Major Triad → Maj button
      renderDegree();
      expect(groupBtn("Chord Type", "Maj").getAttribute("aria-pressed")).toBe("true");
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

  describe("10. Mode label and hint (Degree/Manual toggle)", () => {
    it("renders visible 'Mode' label adjacent to the toggle", () => {
      renderDegree();
      expect(screen.getByText("Mode")).toBeInTheDocument();
    });

    it("renders a short mode hint", () => {
      renderDegree();
      expect(screen.getByText("Off · Diatonic degree · Free root.")).toBeInTheDocument();
    });

    it("does not render a chord mode help button", () => {
      renderDegree();
      expect(screen.queryByRole("button", { name: /show help for chord mode/i })).not.toBeInTheDocument();
    });
  });

  describe("11. 'Degree' label on degree browser", () => {
    it("renders visible 'Degree' label above the degree browser", () => {
      renderDegree();
      expect(screen.getByText("Degree", { selector: "span" })).toBeInTheDocument();
    });
  });

  describe("Task 4: controls always enabled regardless of fingering pattern", () => {
    const PATTERNS = ["one-string", "two-strings", "caged", "none"] as const;

    it.each(PATTERNS)("panel root has no data-disabled when fingeringPattern is %s", (pattern) => {
      const { container } = renderDegree([[fingeringPatternAtom, pattern]]);
      expect(container.firstChild as HTMLElement).not.toHaveAttribute("data-disabled");
    });

    it.each(["one-string", "two-strings", "caged"] as const)(
      "Chord Mode buttons stay enabled when fingeringPattern is %s",
      (pattern) => {
        renderDegree([[fingeringPatternAtom, pattern]]);
        expect(groupBtn("Chord overlay mode", "Degree")).not.toBeDisabled();
        expect(groupBtn("Chord overlay mode", "Manual")).not.toBeDisabled();
      },
    );

    it("first Chord Mode button always shows 'Off' (no 'Disabled' label)", () => {
      renderDegree([[fingeringPatternAtom, "one-string"]]);
      expect(groupBtn("Chord overlay mode", "Off")).toBeInTheDocument();
      expect(queryGroupBtn("Chord overlay mode", "Disabled")).not.toBeInTheDocument();
    });

    it("does not show disabled hint when fingeringPattern is one-string", () => {
      renderDegree([[fingeringPatternAtom, "one-string"]]);
      expect(
        screen.queryByText("Chord overlay disabled for single/two-string patterns."),
      ).not.toBeInTheDocument();
    });

    it("degree selector is visible when fingeringPattern is two-strings (degree mode)", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_MODE_SEEDS,
        [fingeringPatternAtom, "two-strings"],
      ]);
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();
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
      renderDegree();
      expect(screen.getByText("Landing tones · Tension shows chord notes outside the scale.")).toBeInTheDocument();
    });

    it("no legacy lens-hint paragraph remains", () => {
      const { container } = renderDegree();
      expect(container.querySelector(".lens-hint")).not.toBeInTheDocument();
    });
  });

  describe("13. group headers order and Lens placement", () => {
    it("renders SOURCE, CHORD TYPE and VOICING group headers in order", () => {
      renderManual();
      const headers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent?.trim());
      expect(headers[0]).toBe("Source");
      expect(headers[1]).toBe("Chord Type");
      expect(headers[2]).toMatch(/Voicing/);
    });

    it("places the Lens control inside the SOURCE group", () => {
      renderManual();
      const lens = screen.getByText("Lens");
      const sourceHeader = screen.getByRole("heading", { name: "Source" });
      const chordTypeHeader = screen.getByRole("heading", { name: "Chord Type" });
      expect(sourceHeader.compareDocumentPosition(lens) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(lens.compareDocumentPosition(chordTypeHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe("16. VOICING group controls (Type, Inversion, String Set)", () => {
    it("renders Type, Inversion and String Set in the VOICING group", () => {
      renderManual([[voicingTypeAtom, "triad"], [voicingSectionExpandedAtom, true]]);
      expect(screen.getByRole("group", { name: "Voicing type" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Voicing inversion" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "String Set" })).toBeInTheDocument();
    });

    it("disables the 3rd inversion for a triad", () => {
      renderManual([
        [voicingTypeAtom, "triad"],
        [chordQualityOverrideAtom, "Major Triad"],
        [voicingSectionExpandedAtom, true],
      ]);
      expect(screen.getByRole("button", { name: "3rd" })).toBeDisabled();
    });
  });

  describe("18. caged gating — String Set and Inversion hidden for caged voicing type", () => {
    const TRIAD_MANUAL_SEEDS = [
      [scaleNameAtom, "Major"],
      [rootNoteAtom, "C"],
      [chordOverlayModeAtom, "manual"],
      [chordQualityOverrideAtom, "Major Triad"],
      [chordRootOverrideAtom, "C"],
      [fingeringPatternAtom, "caged"],
      [progressionStepsAtom, []],
      [voicingSectionExpandedAtom, true],
    ] as const;

    it.each<{ label: string; extras: readonly (readonly [unknown, unknown])[]; visible: boolean }>([
      { label: "caged", extras: [[voicingTypeAtom, "caged"]], visible: false },
      { label: "triad", extras: [[voicingTypeAtom, "triad"]], visible: true },
      { label: "drop2 (Major 7th)", extras: [[voicingTypeAtom, "drop2"], [chordQualityOverrideAtom, "Major 7th"]], visible: true },
    ])("$label voicing: Inversion + String Set visibility = $visible", ({ extras, visible }) => {
      renderWithAtoms(<ChordOverlayControls />, [...TRIAD_MANUAL_SEEDS, ...extras] as never);
      const inv = screen.queryByLabelText("Voicing inversion");
      const ss = screen.queryByRole("radiogroup", { name: /String Set/i });
      if (visible) {
        expect(inv).toBeInTheDocument();
        expect(ss).toBeInTheDocument();
      } else {
        expect(inv).not.toBeInTheDocument();
        expect(ss).not.toBeInTheDocument();
      }
    });

    it.each<{ label: string; extras: readonly (readonly [unknown, unknown])[]; count: number }>([
      { label: "3-tone (triad)", extras: [[voicingTypeAtom, "triad"]], count: 5 },
      {
        label: "4-tone (Major 7th)",
        extras: [[voicingTypeAtom, "triad"], [chordQualityOverrideAtom, "Major 7th"]],
        count: 4,
      },
    ])("$label chord shows $count radio cards in the String Set picker", ({ extras, count }) => {
      renderWithAtoms(<ChordOverlayControls />, [...TRIAD_MANUAL_SEEDS, ...extras] as never);
      const radiogroup = screen.getByRole("radiogroup", { name: /String Set/i });
      expect(within(radiogroup).getAllByRole("radio")).toHaveLength(count);
    });

    it("normalizer: switching from triad to 4-tone chord removes the stale '4·5·6' string set option", async () => {
      // The 3-string "4·5·6" window exists for a 3-tone chord but not for a 4-tone chord.
      // After the chord change, stringSetOptionsAtom rebuilds with 4-string windows only —
      // "4·5·6" disappears from the option list entirely. The 4-tone "Bass" window is "3·4·5·6".
      const store = makeAtomStore([
        ...TRIAD_MANUAL_SEEDS,
        [voicingTypeAtom, "triad"],
        [voicingStringSetAtom, "4·5·6"],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

      // Initially: Bass card ("4·5·6") present and checked for a 3-tone chord
      const radiogroup = screen.getByRole("radiogroup", { name: /String Set/i });
      expect(within(radiogroup).getByRole("radio", { name: /Bass.*4·5·6/i })).toHaveAttribute("aria-checked", "true");

      // Switch to a 4-tone chord — "4·5·6" is no longer a valid window
      await act(async () => {
        store.set(chordQualityOverrideAtom, "Major 7th");
      });

      // The 4-tone chord renders 4-string windows; "4·5·6" disappears.
      // A new Bass window "3·4·5·6" appears — confirm the 3-string window is gone.
      const radiogroupAfter = await screen.findByRole("radiogroup", { name: /String Set/i });
      // 4-tone chord: 3 windows + All = 4 cards total
      expect(within(radiogroupAfter).getAllByRole("radio")).toHaveLength(4);
      // The old 3-string "4·5·6" id is no longer present (the 4-tone Bass window is "3·4·5·6")
      expect(within(radiogroupAfter).queryByRole("radio", { name: /— 4·5·6/ })).not.toBeInTheDocument();
    });
  });

  describe("19. disabled state + unified heal coupling", () => {
    const TRIAD_SEEDS = [
      [scaleNameAtom, "Major"],
      [rootNoteAtom, "C"],
      [chordOverlayModeAtom, "manual"],
      [chordQualityOverrideAtom, "Major Triad"],
      [chordRootOverrideAtom, "C"],
      [fingeringPatternAtom, "caged"],
      [progressionStepsAtom, []],
      [voicingTypeAtom, "triad"],
      [voicingSectionExpandedAtom, true],
    ] as const;

    it("disabled options: '3rd' inversion button disabled for triad (not in validCombos.enabledInversions)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...TRIAD_SEEDS]);
      expect(groupBtn("Voicing inversion", "3rd")).toBeDisabled();
    });

    it("heal: after chord change to 4-tone chord, active triple is valid in validVoicingCombosAtom.triples", async () => {
      // Seed: drop2 + 1st inversion + a 3-string window stringSet — valid configuration
      // for a 3-tone chord won't be valid for a 4-tone chord because the string-set ids
      // change (3-string → 4-string windows). Spec §5c point 2: on chord change, type is
      // pinned and inversion + string set heal.
      const store = makeAtomStore([
        ...TRIAD_SEEDS,
        [voicingTypeAtom, "drop2"],
        [voicingInversionAtom, "1st"],
        [voicingStringSetAtom, "4·5·6"],
        [voicingSectionExpandedAtom, true],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

      // Switch to a 4-tone chord — "4·5·6" is no longer a valid window id
      await act(async () => {
        store.set(chordQualityOverrideAtom, "Major 7th");
      });

      // Read the final triple
      const finalType = store.get(voicingTypeAtom);
      const finalInversion = store.get(voicingInversionAtom);
      const finalStringSet = store.get(voicingStringSetAtom);
      const validCombos = store.get(validVoicingCombosAtom);

      // The final triple must be valid (chord-change pinned type=drop2; heal snapped stringSet)
      const isValid = validCombos.triples.some(
        (t) =>
          t.type === finalType &&
          t.inversion === finalInversion &&
          t.stringSet === finalStringSet,
      );
      expect(isValid).toBe(true);
    });

    it("user-driven heal: picking an incompatible inversion heals the other two to a valid triple", async () => {
      // Spec §8: a user picks a control value that is globally enabled but yields zero
      // voicings combined with the current other two. The heal pins the just-changed
      // control and snaps the others. Here we set up `drop2 + all` on Major 7th, then
      // pick an inversion that — combined with `(drop2, all)` — yields a valid triple,
      // OR if the user picked one that's NOT valid for that combination, the heal moves
      // the other two. We choose the situation dynamically to find a guaranteed bad combo.
      const store = makeAtomStore([
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "manual"],
        [chordQualityOverrideAtom, "Major 7th"],
        [chordRootOverrideAtom, "C"],
        [fingeringPatternAtom, "caged"],
        [progressionStepsAtom, []],
        [voicingTypeAtom, "drop2"],
        [voicingInversionAtom, "root"],
        [voicingStringSetAtom, "all"],
        [voicingSectionExpandedAtom, true],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

      const combos = store.get(validVoicingCombosAtom);
      // Find an inversion that's globally enabled but invalid with (drop2, all).
      // For every enabled inversion, check if any triple has (drop2, inv, all).
      const enabledInversions = [...combos.enabledInversions];
      const badInversion = enabledInversions.find((inv) =>
        !combos.triples.some(
          (t) => t.type === "drop2" && t.stringSet === "all" && t.inversion === inv,
        ),
      );

      if (badInversion) {
        // Drive the click via the recency-recording onChange path.
        await act(async () => {
          store.set(noteControlChangeAtom, "inversion");
          store.set(voicingInversionAtom, badInversion);
        });

        const finalType = store.get(voicingTypeAtom);
        const finalInversion = store.get(voicingInversionAtom);
        const finalStringSet = store.get(voicingStringSetAtom);
        const validCombos = store.get(validVoicingCombosAtom);
        const isValid = validCombos.triples.some(
          (t) =>
            t.type === finalType &&
            t.inversion === finalInversion &&
            t.stringSet === finalStringSet,
        );
        expect(isValid).toBe(true);
        // The inversion the user picked should be preserved (pinned).
        expect(finalInversion).toBe(badInversion);
      } else {
        // If no such inversion exists for Major 7th (all enabled inversions are valid
        // with drop2+all), the heal path is implicitly covered by the chord-change test.
        // Assert the invariant holds: every enabled inversion forms a valid triple with
        // (drop2, all) — meaning no heal would be needed for an inversion click here.
        for (const inv of enabledInversions) {
          expect(
            combos.triples.some(
              (t) => t.type === "drop2" && t.stringSet === "all" && t.inversion === inv,
            ),
          ).toBe(true);
        }
      }
    });

    it("toggling caged → triad heals the persisted inversion/string-set values", async () => {
      // Seed caged with persisted inversion/stringSet values that would be invalid for
      // the active chord under triad. Switching voicingType to triad re-engages the heal.
      const store = makeAtomStore([
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [chordOverlayModeAtom, "manual"],
        [chordQualityOverrideAtom, "Major Triad"],
        [chordRootOverrideAtom, "C"],
        [fingeringPatternAtom, "caged"],
        [progressionStepsAtom, []],
        [voicingTypeAtom, "caged"],
        // "3rd" inversion isn't available for a triad; "1·2·3·4" is a 4-string window id
        // not present in a 3-tone chord's option list — both are stale/invalid for triad.
        [voicingInversionAtom, "3rd"],
        [voicingStringSetAtom, "1·2·3·4"],
        [voicingSectionExpandedAtom, true],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

      // Switch voicing type from caged to triad — the heal effect now engages.
      await act(async () => {
        store.set(noteControlChangeAtom, "type");
        store.set(voicingTypeAtom, "triad");
      });

      const finalType = store.get(voicingTypeAtom);
      const finalInversion = store.get(voicingInversionAtom);
      const finalStringSet = store.get(voicingStringSetAtom);
      const validCombos = store.get(validVoicingCombosAtom);
      const isValid = validCombos.triples.some(
        (t) =>
          t.type === finalType &&
          t.inversion === finalInversion &&
          t.stringSet === finalStringSet,
      );
      expect(isValid).toBe(true);
      expect(finalType).toBe("triad");
    });

    it("recency: clicking an inversion option moves 'inversion' to front of controlRecencyAtom", async () => {
      const store = makeAtomStore([...TRIAD_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      expect(store.get(controlRecencyAtom)).toEqual(["type", "stringSet", "inversion"]);
      await userEvent.click(groupBtn("Voicing inversion", "1st"));
      expect(store.get(controlRecencyAtom)[0]).toBe("inversion");
    });
  });

  describe("Task 9: Chord Spread stepper and Scope to position switch", () => {
    const VOICING_SEEDS = [
      [scaleNameAtom, "Major"],
      [rootNoteAtom, "C"],
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
      [chordQualityOverrideAtom, "Major Triad"],
      [progressionStepsAtom, []],
      [voicingSectionExpandedAtom, true],
    ] as const;

    it("renders the Chord Spread stepper inside the Voicing section", () => {
      renderWithAtoms(<ChordOverlayControls />, [...VOICING_SEEDS] as never);
      expect(screen.getByText(/chord spread/i)).toBeInTheDocument();
    });

    it.each<{ label: string; extras: readonly (readonly [unknown, unknown])[]; disabled: boolean }>([
      {
        label: "no active position (fingering=none) → disabled",
        extras: [[fingeringPatternAtom, "none"]],
        disabled: true,
      },
      {
        label: "single CAGED shape active → enabled",
        extras: [[fingeringPatternAtom, "caged"], [cagedShapesAtom, new Set(["C"])]],
        disabled: false,
      },
    ])("Scope to position switch: $label", ({ extras, disabled }) => {
      renderWithAtoms(<ChordOverlayControls />, [...VOICING_SEEDS, ...extras] as never);
      const sw = screen.getByRole("switch", { name: /scope to position/i }) as HTMLInputElement;
      if (disabled) expect(sw).toBeDisabled();
      else expect(sw).not.toBeDisabled();
    });
  });

  describe("17. chord-tab design parity", () => {
    it.each(["Chord", "Guide", "Tension"])("Lens toggle includes the %s option", (name) => {
      renderDegree();
      expect(groupBtn("Practice lens", name)).toBeInTheDocument();
    });

    it("Tension lens option is disabled when unavailable", () => {
      // C Major triad on degree I has no outside tones → Tension unavailable.
      renderDegree();
      expect(groupBtn("Practice lens", "Tension")).toBeDisabled();
    });

    it("renders the Connectors toggle in the VOICING group and writes voicingConnectorsAtom", async () => {
      const store = makeAtomStore([...MANUAL_MODE_SEEDS, [voicingConnectorsAtom, false]]);
      renderWithStore(<ChordOverlayControls />, store);
      const toggle = screen.getByRole("switch", { name: "Connectors" });
      expect(toggle).toBeInTheDocument();
      expect(store.get(voicingConnectorsAtom)).toBe(false);
      await userEvent.click(toggle);
      expect(store.get(voicingConnectorsAtom)).toBe(true);
    });

    it.each(["Full Chords", "Show on Board"])("no longer renders the %s switch", (name) => {
      renderManual();
      expect(screen.queryByRole("switch", { name })).toBeNull();
    });

    it.each([
      "How densely the chord is voiced.",
      "Which chord tone is the lowest note.",
      "Full CAGED uses all six strings — pick a subset for partial voicings.",
    ])("renders the hint: %s", (hint) => {
      renderManual([[voicingTypeAtom, "triad"], [voicingSectionExpandedAtom, true]]);
      expect(screen.getByText(hint)).toBeInTheDocument();
    });
  });

  describe("Task 10: collapsible VOICING section", () => {
    const VOICING_COLLAPSE_SEEDS = [
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
      [chordQualityOverrideAtom, "Major Triad"],
      [progressionStepsAtom, []],
    ] as const;

    it("collapses the Voicing section by default (Task 10)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...VOICING_COLLAPSE_SEEDS] as never);
      expect(screen.getByRole("button", { name: /voicing/i })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Voicing type" })).toBeNull();
      expect(screen.queryByRole("group", { name: "Voicing inversion" })).toBeNull();
    });

    it("expands the Voicing section on header click (Task 10)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...VOICING_COLLAPSE_SEEDS] as never);
      const disclosure = screen.getByRole("button", { name: /voicing/i });
      expect(disclosure).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(disclosure);
      expect(disclosure).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("group", { name: "Voicing type" })).toBeInTheDocument();
    });

    it("renders inner Props when voicingSectionExpandedAtom defaults to true (Task 10)", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...VOICING_COLLAPSE_SEEDS,
        [voicingSectionExpandedAtom, true],
        [voicingTypeAtom, "triad"],
      ] as never);
      expect(screen.getByRole("group", { name: "Voicing type" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Voicing inversion" })).toBeInTheDocument();
    });
  });
});
