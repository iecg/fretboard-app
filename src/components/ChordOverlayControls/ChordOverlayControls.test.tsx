// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { act } from "@testing-library/react";
import { renderWithAtoms, renderWithStore, makeAtomStore } from "../../test-utils/renderWithAtoms";
import { practiceLensAtom, voicingConnectorsAtom, voicingTypeAtom, voicingStringSetAtom, voicingInversionAtom } from "../../store/chordOverlayAtoms";
import { voicingSectionExpandedAtom } from "../../store/chordScope";
import { fingeringPatternAtom, cagedShapesAtom } from "../../store/fingeringAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { scaleNameAtom, rootNoteAtom } from "../../store/scaleAtoms";
import {
  activeChordCachedDegreeAtom,
  activeChordIsManualAtom,
  activeChordQualityAtom,
  activeChordRootAtom,
  updateActiveChordAtom,
} from "../../store/songStateAtoms";
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
 * Phase 2.4 unified write surface: the chord under edit is the *active
 * progression step*. The Chord tab reads/writes through
 * `activeChord*Atom` + `updateActiveChordAtom`, which delegate to the active
 * step (`activeProgressionStepAtom`).
 *
 * Default seeds: C Major, one progression step at degree I (= Major Triad).
 * `fingeringPatternAtom = "caged"` keeps the overlay enabled.
 */
const DEGREE_SEEDS = [
  [scaleNameAtom, "Major"],
  [rootNoteAtom, "C"],
  [fingeringPatternAtom, "caged"],
  [progressionStepsAtom, [
    { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  ]],
] as const;

const MANUAL_SEEDS = [
  [scaleNameAtom, "Major"],
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
const queryGroupBtn = (groupName: string, btnName: string | RegExp) =>
  within(screen.getByRole("group", { name: groupName })).queryByRole("button", { name: btnName });

describe("ChordOverlayControls/ChordOverlayControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Phase 2.4 Mode-toggle removal", () => {
    it("does not render the Off/Degree/Manual Mode toggle", () => {
      renderDegree();
      expect(screen.queryByRole("group", { name: /chord overlay mode/i })).not.toBeInTheDocument();
    });

    it("does not render the Mode label", () => {
      renderDegree();
      expect(screen.queryByText("Mode")).not.toBeInTheDocument();
    });

    it("renders Degree picker and Root picker simultaneously (no mode gating)", () => {
      renderDegree();
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Note selector" })).toBeInTheDocument();
    });

    it("renders the chord-type grid unconditionally (no showChordTypeGrid gate)", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [fingeringPatternAtom, "caged"],
        // Step with no degree set yet, no quality override.
        [progressionStepsAtom, [
          { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        ]],
      ]);
      expect(screen.getByRole("group", { name: "Chord Type" })).toBeInTheDocument();
    });

    it("clicking a Root option writes manualRoot through updateActiveChordAtom", async () => {
      const store = makeAtomStore([...DEGREE_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      const rootGroup = screen.getByRole("group", { name: "Note selector" });
      await userEvent.click(within(rootGroup).getByRole("button", { name: "F♯" }));
      expect(store.get(activeChordIsManualAtom)).toBe(true);
      expect(store.get(activeChordRootAtom)).toBe("F#");
    });

    it("picking a degree clears manualRoot and quality (restores diatonic)", async () => {
      const store = makeAtomStore([...DEGREE_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      // Set manualRoot first to confirm a degree click clears it.
      act(() => {
        store.set(updateActiveChordAtom, { root: "F#", quality: "Minor 7th" });
      });
      expect(store.get(activeChordIsManualAtom)).toBe(true);
      // Pick degree V via the degree ToggleBar.
      await userEvent.click(groupBtn("Chord degree", "V"));
      expect(store.get(activeChordIsManualAtom)).toBe(false);
      expect(store.get(activeChordCachedDegreeAtom)).toBe("V");
      // Quality cleared → diatonic default for V = Major Triad.
      expect(store.get(activeChordQualityAtom)).toBe("Major Triad");
    });

    it("clicking a chord-quality option writes through updateActiveChordAtom", async () => {
      const store = makeAtomStore([...DEGREE_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      await userEvent.click(groupBtn("Chord Type", "m7"));
      expect(store.get(activeChordQualityAtom)).toBe("Minor 7th");
    });
  });

  describe("1. degree selection writes the active step's cached degree", () => {
    it("clicking a degree button writes the value", async () => {
      const store = makeAtomStore([...DEGREE_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      const v = groupBtn("Chord degree", "V");
      await userEvent.click(v);
      expect(v.getAttribute("aria-pressed")).toBe("true");
      expect(store.get(activeChordCachedDegreeAtom)).toBe("V");
    });
  });

  describe("3. quality grid renders alongside root + degree", () => {
    it("renders chord-type grid and root note grid simultaneously", () => {
      renderManual();
      expect(screen.getByRole("button", { name: "Maj" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Note selector" })).toBeInTheDocument();
    });

    it("chord-type grid marks seeded quality as pressed (Major Triad → Maj)", () => {
      renderManual();
      expect(groupBtn("Chord Type", "Maj").getAttribute("aria-pressed")).toBe("true");
    });

    it("selecting a chord type updates the active chord's quality", async () => {
      const store = makeAtomStore([...MANUAL_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      await userEvent.click(groupBtn("Chord Type", "m7"));
      expect(groupBtn("Chord Type", "m7").getAttribute("aria-pressed")).toBe("true");
      expect(store.get(activeChordQualityAtom)).toBe("Minor 7th");
    });
  });

  describe("4. persistence: seeded atom values are reflected in the UI", () => {
    it("seeded degree='V' marks V button as pressed", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [progressionStepsAtom, [
          { id: "step-1", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        ]],
      ]);
      expect(groupBtn("Chord degree", "V").getAttribute("aria-pressed")).toBe("true");
    });

    it("seeded manual step with qualityOverride='Major 7th' marks M7 button as pressed", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [progressionStepsAtom, [
          { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major 7th", manualRoot: "G" },
        ]],
      ]);
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
      renderWithAtoms(<ChordOverlayControls />, [
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [fingeringPatternAtom, "caged"],
        [progressionStepsAtom, [
          { id: "step-1", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        ]],
      ]);
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
        [fingeringPatternAtom, "caged"],
        [progressionStepsAtom, [
          { id: "one", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
        ]],
      ]);
      renderWithStore(<ChordOverlayControls />, store);
      expect(groupBtn("Chord degree", "V")).toHaveAttribute("aria-pressed", "true");
      await userEvent.click(groupBtn("Chord Type", "m7"));
      expect(store.get(progressionStepsAtom)[0]?.qualityOverride).toBe("Minor 7th");
    });
  });

  describe("a11y + group labels", () => {
    it.each([
      { label: "diatonic step", seeds: DEGREE_SEEDS },
      { label: "manual step", seeds: MANUAL_SEEDS },
    ])("$label has no a11y violations", async ({ seeds }) => {
      const { container } = renderWithAtoms(<ChordOverlayControls />, [...seeds]);
      expect(await axe(container)).toHaveNoViolations();
    });

    it("exposes the expected group labels and 7 diatonic degrees", () => {
      renderDegree();
      const degreeGroup = screen.getByRole("group", { name: "Chord degree" });
      expect(within(degreeGroup).queryByRole("button", { name: "Off" })).not.toBeInTheDocument();
      expect(within(degreeGroup).getByRole("button", { name: "I" })).toBeInTheDocument();
      expect(within(degreeGroup).getByRole("button", { name: "vii°" })).toBeInTheDocument();
      expect(within(degreeGroup).getAllByRole("button")).toHaveLength(7);
    });
  });

  describe("7. lens picker remains functional", () => {
    it("lens ToggleBar is present when chord is active", () => {
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
  });

  describe("8. chord-type grid (always visible)", () => {
    it("renders 'Quality' label", () => {
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

    it("Off button is absent from chord-type grid", () => {
      renderDegree();
      expect(queryGroupBtn("Chord Type", "Off")).not.toBeInTheDocument();
    });

    it("resolved diatonic chord-type is highlighted without user interaction (degree I → Maj)", () => {
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

  describe("11. 'Degree' label on degree browser", () => {
    it("renders visible 'Degree' label above the degree browser", () => {
      renderDegree();
      expect(screen.getByText("Degree", { selector: "span[class*='propLabel']" })).toBeInTheDocument();
    });
  });

  describe("11b. 'Root' label on root picker", () => {
    it("renders visible 'Root' label above the root picker", () => {
      renderDegree();
      expect(screen.getByText("Root", { selector: "span[class*='propLabel']" })).toBeInTheDocument();
    });
  });

  describe("Task 4: controls always enabled regardless of fingering pattern", () => {
    const PATTERNS = ["one-string", "two-strings", "caged", "none"] as const;

    it.each(PATTERNS)("panel root has no data-disabled when fingeringPattern is %s", (pattern) => {
      const { container } = renderDegree([[fingeringPatternAtom, pattern]]);
      expect(container.firstChild as HTMLElement).not.toHaveAttribute("data-disabled");
    });

    it("degree selector is visible when fingeringPattern is two-strings", () => {
      renderWithAtoms(<ChordOverlayControls />, [
        ...DEGREE_SEEDS,
        [fingeringPatternAtom, "two-strings"],
      ]);
      expect(screen.getByRole("group", { name: "Chord degree" })).toBeInTheDocument();
    });
  });

  describe("12. lens Prop shows static hint", () => {
    it("does not render a lens help-button when chord is active", () => {
      renderDegree();
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
        [voicingSectionExpandedAtom, true],
      ]);
      expect(screen.getByRole("button", { name: "3rd" })).toBeDisabled();
    });
  });

  describe("18. caged gating — String Set and Inversion hidden for caged voicing type", () => {
    const TRIAD_MANUAL_SEEDS = [
      [scaleNameAtom, "Major"],
      [rootNoteAtom, "C"],
      [fingeringPatternAtom, "caged"],
      [progressionStepsAtom, [
        { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
      ]],
      [voicingSectionExpandedAtom, true],
    ] as const;

    const buildSeeds = (
      qualityOverride: string,
      voicingType: "caged" | "triad" | "drop2",
    ) => [
      [scaleNameAtom, "Major"],
      [rootNoteAtom, "C"],
      [fingeringPatternAtom, "caged"],
      [progressionStepsAtom, [
        { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride, manualRoot: "C" },
      ]],
      [voicingSectionExpandedAtom, true],
      [voicingTypeAtom, voicingType],
    ] as const;

    it.each<{ label: string; seeds: ReturnType<typeof buildSeeds>; visible: boolean }>([
      { label: "caged", seeds: buildSeeds("Major Triad", "caged"), visible: false },
      { label: "triad", seeds: buildSeeds("Major Triad", "triad"), visible: true },
      { label: "drop2 (Major 7th)", seeds: buildSeeds("Major 7th", "drop2"), visible: true },
    ])("$label voicing: Inversion + String Set visibility = $visible", ({ seeds, visible }) => {
      renderWithAtoms(<ChordOverlayControls />, [...seeds] as never);
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

    it.each<{ label: string; seeds: ReturnType<typeof buildSeeds>; count: number }>([
      { label: "3-tone (triad)", seeds: buildSeeds("Major Triad", "triad"), count: 5 },
      { label: "4-tone (Major 7th)", seeds: buildSeeds("Major 7th", "triad"), count: 4 },
    ])("$label chord shows $count radio cards in the String Set picker", ({ seeds, count }) => {
      renderWithAtoms(<ChordOverlayControls />, [...seeds] as never);
      const radiogroup = screen.getByRole("radiogroup", { name: /String Set/i });
      expect(within(radiogroup).getAllByRole("radio")).toHaveLength(count);
    });

    it("normalizer: switching from triad to 4-tone chord removes the stale '4·5·6' string set option", async () => {
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
        store.set(updateActiveChordAtom, { quality: "Major 7th" });
      });

      const radiogroupAfter = await screen.findByRole("radiogroup", { name: /String Set/i });
      expect(within(radiogroupAfter).getAllByRole("radio")).toHaveLength(4);
      expect(within(radiogroupAfter).queryByRole("radio", { name: /— 4·5·6/ })).not.toBeInTheDocument();
    });
  });

  describe("19. disabled state + unified heal coupling", () => {
    const TRIAD_SEEDS = [
      [scaleNameAtom, "Major"],
      [rootNoteAtom, "C"],
      [fingeringPatternAtom, "caged"],
      [progressionStepsAtom, [
        { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
      ]],
      [voicingTypeAtom, "triad"],
      [voicingSectionExpandedAtom, true],
    ] as const;

    it("disabled options: '3rd' inversion button disabled for triad (not in validCombos.enabledInversions)", () => {
      renderWithAtoms(<ChordOverlayControls />, [...TRIAD_SEEDS]);
      expect(groupBtn("Voicing inversion", "3rd")).toBeDisabled();
    });

    it("heal: after chord change to 4-tone chord, active triple is valid in validVoicingCombosAtom.triples", async () => {
      const store = makeAtomStore([
        ...TRIAD_SEEDS,
        [voicingTypeAtom, "drop2"],
        [voicingInversionAtom, "1st"],
        [voicingStringSetAtom, "4·5·6"],
        [voicingSectionExpandedAtom, true],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

      await act(async () => {
        store.set(updateActiveChordAtom, { quality: "Major 7th" });
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
    });

    it("user-driven heal: picking an incompatible inversion heals the other two to a valid triple", async () => {
      const store = makeAtomStore([
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [fingeringPatternAtom, "caged"],
        [progressionStepsAtom, [
          { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major 7th", manualRoot: "C" },
        ]],
        [voicingTypeAtom, "drop2"],
        [voicingInversionAtom, "root"],
        [voicingStringSetAtom, "all"],
        [voicingSectionExpandedAtom, true],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

      const combos = store.get(validVoicingCombosAtom);
      const enabledInversions = [...combos.enabledInversions];
      const badInversion = enabledInversions.find((inv) =>
        !combos.triples.some(
          (t) => t.type === "drop2" && t.stringSet === "all" && t.inversion === inv,
        ),
      );

      if (badInversion) {
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
        expect(finalInversion).toBe(badInversion);
      } else {
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
      const store = makeAtomStore([
        [scaleNameAtom, "Major"],
        [rootNoteAtom, "C"],
        [fingeringPatternAtom, "caged"],
        [progressionStepsAtom, [
          { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
        ]],
        [voicingTypeAtom, "caged"],
        [voicingInversionAtom, "3rd"],
        [voicingStringSetAtom, "1·2·3·4"],
        [voicingSectionExpandedAtom, true],
      ]);
      renderWithStore(<ChordOverlayControls />, store);

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
      [progressionStepsAtom, [
        { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
      ]],
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
      const store = makeAtomStore([...MANUAL_SEEDS, [voicingConnectorsAtom, false]]);
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
      [progressionStepsAtom, [
        { id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
      ]],
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
