import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { scaleDegreeColorsEnabledAtom } from "../../store/uiAtoms";
import { ChordPracticeBar } from "./ChordPracticeBar";
import type { PracticeBarGroup, PracticeBarNote } from "@fretflow/core";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { chordOverlayHiddenAtom, chordHiddenNotesAtom, chordRootOverrideAtom, chordQualityOverrideAtom, chordOverlayModeAtom } from "../../store/chordOverlayAtoms";

// ── Fixture notes ────────────────────────────────────────────────────────────

const mkNote = (
  overrides: Partial<PracticeBarNote> &
    Pick<PracticeBarNote, "internalNote" | "displayNote">,
): PracticeBarNote => ({
  intervalName: "1",
  isChordRoot: false,
  isGuideTone: false,
  isTension: false,
  isInScale: true,
  ...overrides,
});

// D Minor 7 — D F A C (fully in C Major scale; D is chord root)
const dmin7ChordGroup: PracticeBarGroup = {
  label: "Chord",
  notes: [
    mkNote({ internalNote: "D", displayNote: "D", intervalName: "1", isChordRoot: true }),
    mkNote({ internalNote: "F", displayNote: "F", intervalName: "♭3", isGuideTone: true }),
    mkNote({ internalNote: "A", displayNote: "A", intervalName: "5" }),
    mkNote({ internalNote: "C", displayNote: "C", intervalName: "♭7", isGuideTone: true }),
  ],
};

// C# Minor Triad on C Major — C#, E, G#
// C# = outside chord root (isChordRoot + isTension both set)
// G# = outside non-root chord tone (tension only)
// E  = in-scale chord tone
const cSharpMinorChordGroup: PracticeBarGroup = {
  label: "Chord",
  notes: [
    mkNote({
      internalNote: "C#",
      displayNote: "C♯",
      intervalName: "1",
      isChordRoot: true,
      isTension: true,
      isInScale: false,
    }),
    mkNote({ internalNote: "E", displayNote: "E", intervalName: "♭3" }),
    mkNote({
      internalNote: "G#",
      displayNote: "G♯",
      intervalName: "5",
      isTension: true,
      isInScale: false,
    }),
  ],
};

const cSharpMinorTensionLandOn: PracticeBarGroup = {
  label: "Land on",
  notes: [
    mkNote({
      internalNote: "C#",
      displayNote: "C♯",
      intervalName: "1",
      isChordRoot: true,
      isTension: true,
      isInScale: false,
      resolvesTo: { internalNote: "D", displayNote: "D" },
    }),
    mkNote({
      internalNote: "G#",
      displayNote: "G♯",
      intervalName: "5",
      isTension: true,
      isInScale: false,
      resolvesTo: { internalNote: "A", displayNote: "A" },
    }),
  ],
};

const g7GuideToneLandOn: PracticeBarGroup = {
  label: "Land on",
  notes: [
    mkNote({ internalNote: "B", displayNote: "B", intervalName: "3", isGuideTone: true }),
    mkNote({ internalNote: "F", displayNote: "F", intervalName: "♭7", isGuideTone: true }),
  ],
};

// Same notes as dmin7ChordGroup but labelled "Land on" — for the targets lens
// where the Land on group mirrors the Chord group.
const dmin7LandOnGroup: PracticeBarGroup = {
  label: "Land on",
  notes: dmin7ChordGroup.notes,
};

const emptyGroup: PracticeBarGroup = { label: "Land on", notes: [] };

// Preset shorthands for the most common test fixtures.
const DMIN7 = { title: "D Minor 7", chordGroup: dmin7ChordGroup, landOnGroup: dmin7LandOnGroup };
const G7_GUIDE = { title: "G7", lensLabel: "Guide Tones", chordGroup: dmin7ChordGroup, landOnGroup: g7GuideToneLandOn };
const CSHARP_TENSION = { title: "C# Minor Triad", lensLabel: "Tension", chordGroup: cSharpMinorChordGroup, landOnGroup: cSharpMinorTensionLandOn };

const renderBar = (props: Partial<React.ComponentProps<typeof ChordPracticeBar>> = {}) =>
  render(<ChordPracticeBar {...DMIN7} {...props} />);

const renderBarWithHidden = (hidden: boolean, props: Partial<React.ComponentProps<typeof ChordPracticeBar>> = {}) =>
  renderWithAtoms(
    <ChordPracticeBar {...DMIN7} {...props} />,
    [[chordOverlayHiddenAtom, hidden]],
  );

// ─────────────────────────────────────────────────────────────────────────────

describe("ChordPracticeBar/ChordPracticeBar", () => {
  it("renders a role=group with aria-label containing the title", () => {
    renderBar();
    expect(screen.getByRole("group", { name: "Practice cues: D Minor 7" })).toBeTruthy();
  });

  it("renders the title", () => {
    renderBar();
    expect(screen.getByText("D Minor 7")).toBeTruthy();
  });

  it("renders optional badge when provided", () => {
    renderBar({ badge: "Targets" });
    expect(screen.getByText("Targets")).toBeTruthy();
  });

  it("never renders the lens-label chip, even when lensLabel is provided", () => {
    // The "Chord Tones" chip was removed — the active lens is surfaced in the
    // status bar instead. The prop is still accepted but rendered nowhere.
    const { container } = renderBar(G7_GUIDE);
    expect(container.querySelector(".chord-practice-bar-lens-label")).toBeNull();
    expect(screen.queryByText("Guide Tones")).toBeNull();
  });

  it("returns null when both groups are empty", () => {
    const { container } = render(
      <ChordPracticeBar title="Empty" chordGroup={{ label: "Chord", notes: [] }} landOnGroup={emptyGroup} />,
    );
    expect(container.firstChild).toBeNull();
  });

  describe("two-group layout", () => {
    it("renders Chord and Land on as separate labeled groups when Land on is a narrower subset", () => {
      renderBar(G7_GUIDE);
      expect(screen.getByText("Chord:")).toBeTruthy();
      expect(screen.getByText("Land on:")).toBeTruthy();
    });

    it("marks groups with data-group-variant for desktop side-by-side styling", () => {
      const { container } = renderBar(G7_GUIDE);
      expect(container.querySelector('[data-group-variant="chord"]')).toBeTruthy();
      expect(container.querySelector('[data-group-variant="land-on"]')).toBeTruthy();
    });

    it("does not render a shape-context subtitle", () => {
      const { container } = renderBar();
      expect(container.querySelector(".chord-practice-bar-context")).toBeNull();
    });
  });

  describe("collapsed group rendering", () => {
    it("renders only Land on when it is semantically identical to Chord", () => {
      const { container } = renderBar({ lensLabel: "Chord Tones" });
      expect(screen.queryByText("Chord:")).toBeNull();
      expect(screen.getByText("Land on:")).toBeTruthy();
      expect(container.querySelectorAll('[data-group-variant="chord"]').length).toBe(0);
      expect(container.querySelectorAll('[data-group-variant="land-on"]').length).toBe(1);
    });

    it.each([
      ["tension", CSHARP_TENSION],
      ["guide tones", G7_GUIDE],
    ] as const)("renders both groups when Land on carries %s data", (_label, preset) => {
      renderBar(preset);
      expect(screen.getByText("Chord:")).toBeTruthy();
      expect(screen.getByText("Land on:")).toBeTruthy();
    });
  });

  describe("composable semantic flags", () => {
    it("chord root pill carries data-chord-root=true", () => {
      const { container } = renderBar();
      expect(container.querySelector('[data-chord-root="true"]')).toBeTruthy();
    });

    it("guide tones carry data-guide-tone=true and are distinct from ordinary chord tones", () => {
      const { container } = renderBar(G7_GUIDE);
      const guidePills = container.querySelectorAll(
        '[data-group-variant="land-on"] [data-guide-tone="true"]',
      );
      expect(guidePills.length).toBe(2);
      // Ordinary chord tone (A, the 5th) should not carry the guide-tone flag.
      const plainTone = Array.from(
        container.querySelectorAll('[data-group-variant="chord"] .practice-bar-pill'),
      ).find((el) => el.textContent?.includes("A"));
      expect(plainTone?.getAttribute("data-guide-tone")).toBeNull();
    });

    it("outside chord root carries BOTH data-chord-root AND data-tension", () => {
      const { container } = renderBar(CSHARP_TENSION);
      // Chord group's C♯ pill must preserve both root + tension identities.
      const cSharpInChord = container.querySelector(
        '[data-group-variant="chord"] [data-chord-root="true"][data-tension="true"]',
      );
      expect(cSharpInChord).toBeTruthy();
      expect(cSharpInChord?.textContent).toContain("C♯");
    });

    it("outside non-root chord tones carry only data-tension", () => {
      const { container } = renderBar(CSHARP_TENSION);
      const gSharpPill = Array.from(
        container.querySelectorAll('[data-group-variant="chord"] [data-tension="true"]'),
      ).find((el) => el.textContent?.includes("G♯"));
      expect(gSharpPill).toBeTruthy();
      expect(gSharpPill?.getAttribute("data-chord-root")).toBeNull();
    });

    it("degree colors remain available on chord-root and guide-tone pills", () => {
      const coloredChordGroup: PracticeBarGroup = {
        label: "Chord",
        notes: [
          mkNote({
            internalNote: "C",
            displayNote: "C",
            intervalName: "I",
            isChordRoot: true,
            scaleDegree: "I",
            degreeColor: "#ff7f00",
          }),
          mkNote({
            internalNote: "E",
            displayNote: "E",
            intervalName: "iii",
            isGuideTone: true,
            scaleDegree: "iii",
            degreeColor: "#4daf4a",
          }),
        ],
      };

      const store = createStore();
      store.set(scaleDegreeColorsEnabledAtom, true);

      const { container } = render(
        <Provider store={store}>
          <ChordPracticeBar
            title="C Major"
            chordGroup={coloredChordGroup}
            landOnGroup={coloredChordGroup}
          />
        </Provider>
      );

      const rootPill = container.querySelector(
        '[data-chord-root="true"][data-scale-degree="I"]',
      ) as HTMLElement | null;
      const guideTonePill = container.querySelector(
        '[data-guide-tone="true"][data-scale-degree="iii"]',
      ) as HTMLElement | null;

      expect(rootPill?.style.getPropertyValue("--degree-color")).toBe("#ff7f00");
      expect(guideTonePill?.style.getPropertyValue("--degree-color")).toBe("#4daf4a");
      expect(screen.getByText("I")).toBeTruthy();
      expect(screen.getByText("iii")).toBeTruthy();
      expect(container.querySelector(".chord-practice-bar")?.getAttribute("data-degree-colors")).toBe("true");
    });

    it("renders resolution arrows for tension land-on notes", () => {
      renderBar(CSHARP_TENSION);
      expect(screen.getByText("→D")).toBeTruthy();
      expect(screen.getByText("→A")).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it.each([
      { lens: "targets", title: "D Minor 7", lensLabel: "Chord Tones", chord: dmin7ChordGroup, landOn: dmin7LandOnGroup },
      { lens: "guide-tones", title: "G7", lensLabel: "Guide Tones", chord: dmin7ChordGroup, landOn: g7GuideToneLandOn },
      { lens: "tension", title: "C# Minor Triad", lensLabel: "Tension", chord: cSharpMinorChordGroup, landOn: cSharpMinorTensionLandOn },
    ])("has no a11y violations ($lens lens)", async ({ title, lensLabel, chord, landOn }) => {
      const { container } = render(
        <ChordPracticeBar title={title} lensLabel={lensLabel} chordGroup={chord} landOnGroup={landOn} />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("visibility toggle (eye button + pill clicks)", () => {
    it.each<{ hidden: boolean; pressed: "true" | "false"; iconShown: string; iconHidden: string }>([
      { hidden: false, pressed: "false", iconShown: ".lucide-eye", iconHidden: ".lucide-eye-off" },
      { hidden: true, pressed: "true", iconShown: ".lucide-eye-off", iconHidden: ".lucide-eye" },
    ])("eye button aria-pressed=$pressed and matching icon when hidden=$hidden", ({ hidden, pressed, iconShown, iconHidden }) => {
      const { container } = renderBarWithHidden(hidden);
      expect(screen.getByRole("button", { name: "Toggle visibility of chord overlay" })).toBeTruthy();
      const eyeBtn = container.querySelector(".practice-bar-eye-toggle");
      expect(eyeBtn?.getAttribute("aria-pressed")).toBe(pressed);
      expect(eyeBtn?.querySelector(iconShown)).toBeTruthy();
      expect(eyeBtn?.querySelector(iconHidden)).toBeNull();
    });

    it.each<[boolean, string | null]>([
      [true, "true"],
      [false, null],
    ])("section data-collapsed when hidden=%s → %s", (hidden, expected) => {
      const { container } = renderBarWithHidden(hidden);
      expect(container.querySelector("section")?.getAttribute("data-collapsed")).toBe(expected);
    });

    it("collapsing hides the chord-practice-bar-groups section (DegreeChipStrip-style collapse)", () => {
      const { container } = renderBarWithHidden(true);
      expect(container.querySelector(".chord-practice-bar-groups")).toBeNull();
    });

    it.each<{ initial: boolean; expected: boolean }>([
      { initial: false, expected: true },
      { initial: true, expected: false },
    ])("clicking the eye button toggles chordOverlayHiddenAtom $initial → $expected", ({ initial, expected }) => {
      const store = makeAtomStore([
        [chordOverlayHiddenAtom, initial],
        [chordOverlayModeAtom, "manual"],
        [chordRootOverrideAtom, "D"],
        [chordQualityOverrideAtom, "Minor 7th"],
      ]);
      renderWithStore(<ChordPracticeBar {...DMIN7} />, store);
      fireEvent.click(screen.getByRole("button", { name: "Toggle visibility of chord overlay" }));
      expect(store.get(chordOverlayHiddenAtom)).toBe(expected);
    });

    it("clicking a pill toggles only that note in chordHiddenNotesAtom (round-trip)", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      const { container } = renderWithStore(<ChordPracticeBar {...DMIN7} />, store);
      const dPill = container.querySelector<HTMLButtonElement>('.practice-bar-pill[data-chord-root="true"]');
      expect(dPill).toBeTruthy();
      fireEvent.click(dPill!);
      expect(store.get(chordHiddenNotesAtom).has("D")).toBe(true);
      expect(store.get(chordOverlayHiddenAtom)).toBe(false); // eye state untouched
      fireEvent.click(dPill!);
      expect(store.get(chordHiddenNotesAtom).has("D")).toBe(false);
    });

    it("pill buttons default to aria-pressed=true (note visible) when chord is visible", () => {
      const { container } = renderBarWithHidden(false);
      const pillButtons = container.querySelectorAll(".practice-bar-pill");
      expect(pillButtons.length).toBeGreaterThan(0);
      for (const pill of pillButtons) {
        expect(pill.getAttribute("aria-pressed")).toBe("true");
      }
    });

    it("pills are not rendered when overlay is collapsed", () => {
      const { container } = renderBarWithHidden(true);
      expect(container.querySelectorAll(".practice-bar-pill").length).toBe(0);
    });

    it("after clicking, the pill carries aria-pressed=false (hidden) and data-hidden-note='true'", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      const { container } = renderWithStore(<ChordPracticeBar {...DMIN7} />, store);
      const dPill = container.querySelector<HTMLButtonElement>('.practice-bar-pill[data-chord-root="true"]');
      expect(dPill).toBeTruthy();
      fireEvent.click(dPill!);
      const dPillAfter = container.querySelector('.practice-bar-pill[data-chord-root="true"]');
      expect(dPillAfter?.getAttribute("aria-pressed")).toBe("false");
      expect(dPillAfter?.getAttribute("data-hidden-note")).toBe("true");
    });

    it("pills sharing an internalNote across chord and land-on groups toggle together", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      const { container } = renderWithStore(
        <ChordPracticeBar title="C# Minor" chordGroup={cSharpMinorChordGroup} landOnGroup={cSharpMinorTensionLandOn} />,
        store,
      );
      // C# is chord root in both groups → two pills with data-chord-root="true"
      const allPills = container.querySelectorAll<HTMLButtonElement>('.practice-bar-pill[data-chord-root="true"]');
      expect(allPills.length).toBe(2);
      fireEvent.click(allPills[0]!);
      expect(allPills[0]!.getAttribute("data-hidden-note")).toBe("true");
      expect(allPills[1]!.getAttribute("data-hidden-note")).toBe("true");
      expect(store.get(chordHiddenNotesAtom).has("C#")).toBe(true);
    });

    it.each([
      ["visible", false],
      ["hidden", true],
    ] as const)("has no a11y violations when %s", async (_label, hidden) => {
      const { container } = renderBarWithHidden(hidden, { lensLabel: "Chord Tones" });
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
