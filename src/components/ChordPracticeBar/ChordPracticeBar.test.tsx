import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChordPracticeBar } from "./ChordPracticeBar";
import type { PracticeBarGroup, PracticeBarNote } from "../../core/theory";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
  chordRootOverrideAtom,
  chordQualityOverrideAtom,
  chordOverlayModeAtom,
} from "../../store/atoms";

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

// ─────────────────────────────────────────────────────────────────────────────

describe("ChordPracticeBar/ChordPracticeBar", () => {
  it("renders a role=group with aria-label containing the title", () => {
    render(
      <ChordPracticeBar
        title="D Minor 7"
        chordGroup={dmin7ChordGroup}
        landOnGroup={dmin7LandOnGroup}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Practice cues: D Minor 7" }),
    ).toBeTruthy();
  });

  it("renders the title", () => {
    render(
      <ChordPracticeBar
        title="D Minor 7"
        chordGroup={dmin7ChordGroup}
        landOnGroup={dmin7LandOnGroup}
      />,
    );
    expect(screen.getByText("D Minor 7")).toBeTruthy();
  });

  it("renders optional badge when provided", () => {
    render(
      <ChordPracticeBar
        title="D Minor 7"
        badge="Targets"
        chordGroup={dmin7ChordGroup}
        landOnGroup={dmin7LandOnGroup}
      />,
    );
    expect(screen.getByText("Targets")).toBeTruthy();
  });

  it("renders lensLabel when provided", () => {
    render(
      <ChordPracticeBar
        title="G7"
        lensLabel="Guide Tones"
        chordGroup={dmin7ChordGroup}
        landOnGroup={g7GuideToneLandOn}
      />,
    );
    expect(screen.getByText("Guide Tones")).toBeTruthy();
  });

  it("does not render lens-label element when lensLabel is omitted", () => {
    const { container } = render(
      <ChordPracticeBar
        title="D Minor 7"
        chordGroup={dmin7ChordGroup}
        landOnGroup={dmin7LandOnGroup}
      />,
    );
    expect(container.querySelector(".chord-practice-bar-lens-label")).toBeNull();
  });

  it("returns null when both groups are empty", () => {
    const { container } = render(
      <ChordPracticeBar
        title="Empty"
        chordGroup={{ label: "Chord", notes: [] }}
        landOnGroup={emptyGroup}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  describe("two-group layout", () => {
    it("renders Chord and Land on as separate labeled groups when Land on is a narrower subset", () => {
      render(
        <ChordPracticeBar
          title="G7"
          lensLabel="Guide Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={g7GuideToneLandOn}
        />,
      );
      expect(screen.getByText("Chord:")).toBeTruthy();
      expect(screen.getByText("Land on:")).toBeTruthy();
    });

    it("marks groups with data-group-variant for desktop side-by-side styling", () => {
      const { container } = render(
        <ChordPracticeBar
          title="G7"
          lensLabel="Guide Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={g7GuideToneLandOn}
        />,
      );
      expect(
        container.querySelector('[data-group-variant="chord"]'),
      ).toBeTruthy();
      expect(
        container.querySelector('[data-group-variant="land-on"]'),
      ).toBeTruthy();
    });

    it("does not render a shape-context subtitle", () => {
      const { container } = render(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
      );
      expect(
        container.querySelector(".chord-practice-bar-context"),
      ).toBeNull();
    });
  });

  describe("collapsed group rendering", () => {
    it("renders only Land on when it is semantically identical to Chord", () => {
      const { container } = render(
        <ChordPracticeBar
          title="D Minor 7"
          lensLabel="Chord Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
      );
      expect(screen.queryByText("Chord:")).toBeNull();
      expect(screen.getByText("Land on:")).toBeTruthy();
      expect(
        container.querySelectorAll('[data-group-variant="chord"]').length,
      ).toBe(0);
      expect(
        container.querySelectorAll('[data-group-variant="land-on"]').length,
      ).toBe(1);
    });

    it("renders both groups when Land on carries resolution data (tension)", () => {
      render(
        <ChordPracticeBar
          title="C# Minor Triad"
          lensLabel="Tension"
          chordGroup={cSharpMinorChordGroup}
          landOnGroup={cSharpMinorTensionLandOn}
        />,
      );
      expect(screen.getByText("Chord:")).toBeTruthy();
      expect(screen.getByText("Land on:")).toBeTruthy();
    });

    it("renders both groups when Land on is a narrower subset (guide tones)", () => {
      render(
        <ChordPracticeBar
          title="G7"
          lensLabel="Guide Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={g7GuideToneLandOn}
        />,
      );
      expect(screen.getByText("Chord:")).toBeTruthy();
      expect(screen.getByText("Land on:")).toBeTruthy();
    });
  });

  describe("composable semantic flags", () => {
    it("chord root pill carries data-chord-root=true", () => {
      const { container } = render(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
      );
      expect(container.querySelector('[data-chord-root="true"]')).toBeTruthy();
    });

    it("guide tones carry data-guide-tone=true and are distinct from ordinary chord tones", () => {
      const { container } = render(
        <ChordPracticeBar
          title="G7"
          lensLabel="Guide Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={g7GuideToneLandOn}
        />,
      );
      const guidePills = container.querySelectorAll(
        '[data-group-variant="land-on"] [data-guide-tone="true"]',
      );
      expect(guidePills.length).toBe(2);
      // Ordinary chord tone (A, the 5th) should not carry the guide-tone flag.
      const chordPills = container.querySelectorAll(
        '[data-group-variant="chord"] .practice-bar-pill',
      );
      const plainTone = Array.from(chordPills).find(
        (el) => el.textContent?.includes("A"),
      );
      expect(plainTone?.getAttribute("data-guide-tone")).toBeNull();
    });

    it("outside chord root carries BOTH data-chord-root AND data-tension", () => {
      const { container } = render(
        <ChordPracticeBar
          title="C# Minor Triad"
          lensLabel="Tension"
          chordGroup={cSharpMinorChordGroup}
          landOnGroup={cSharpMinorTensionLandOn}
        />,
      );
      // Chord group's C♯ pill must preserve both root + tension identities.
      const cSharpInChord = container.querySelector(
        '[data-group-variant="chord"] [data-chord-root="true"][data-tension="true"]',
      );
      expect(cSharpInChord).toBeTruthy();
      expect(cSharpInChord?.textContent).toContain("C♯");
    });

    it("outside non-root chord tones carry only data-tension", () => {
      const { container } = render(
        <ChordPracticeBar
          title="C# Minor Triad"
          lensLabel="Tension"
          chordGroup={cSharpMinorChordGroup}
          landOnGroup={cSharpMinorTensionLandOn}
        />,
      );
      const gSharpPill = Array.from(
        container.querySelectorAll(
          '[data-group-variant="chord"] [data-tension="true"]',
        ),
      ).find((el) => el.textContent?.includes("G♯"));
      expect(gSharpPill).toBeTruthy();
      expect(gSharpPill?.getAttribute("data-chord-root")).toBeNull();
    });

    it("renders resolution arrows for tension land-on notes", () => {
      render(
        <ChordPracticeBar
          title="C# Minor Triad"
          lensLabel="Tension"
          chordGroup={cSharpMinorChordGroup}
          landOnGroup={cSharpMinorTensionLandOn}
        />,
      );
      expect(screen.getByText("→D")).toBeTruthy();
      expect(screen.getByText("→A")).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("has no a11y violations (targets lens)", async () => {
      const { container } = render(
        <ChordPracticeBar
          title="D Minor 7"
          lensLabel="Chord Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no a11y violations (guide-tones lens)", async () => {
      const { container } = render(
        <ChordPracticeBar
          title="G7"
          lensLabel="Guide Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={g7GuideToneLandOn}
        />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no a11y violations (tension lens)", async () => {
      const { container } = render(
        <ChordPracticeBar
          title="C# Minor Triad"
          lensLabel="Tension"
          chordGroup={cSharpMinorChordGroup}
          landOnGroup={cSharpMinorTensionLandOn}
        />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("visibility toggle (eye button + pill clicks)", () => {
    it("renders an eye button with stable aria-label when visible", () => {
      renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, false]],
      );
      expect(
        screen.getByRole("button", { name: "Toggle visibility of chord overlay" }),
      ).toBeTruthy();
    });

    it("renders the same stable aria-label when hidden", () => {
      renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, true]],
      );
      expect(
        screen.getByRole("button", { name: "Toggle visibility of chord overlay" }),
      ).toBeTruthy();
    });

    it("eye button has aria-pressed=true when overlay is visible", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, false]],
      );
      const eyeBtn = container.querySelector(".practice-bar-eye-toggle");
      expect(eyeBtn?.getAttribute("aria-pressed")).toBe("true");
    });

    it("eye button has aria-pressed=false when overlay is hidden", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, true]],
      );
      const eyeBtn = container.querySelector(".practice-bar-eye-toggle");
      expect(eyeBtn?.getAttribute("aria-pressed")).toBe("false");
    });

    it("renders eye-open icon (data-icon) when overlay is visible", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, false]],
      );
      const eyeBtn = container.querySelector(".practice-bar-eye-toggle");
      expect(eyeBtn?.getAttribute("aria-pressed")).toBe("true");
      expect(eyeBtn?.querySelector('[data-icon="eye-open"]')).toBeTruthy();
      expect(eyeBtn?.querySelector('[data-icon="eye-closed"]')).toBeNull();
    });

    it("renders eye-closed icon (data-icon) when overlay is hidden", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, true]],
      );
      const eyeBtn = container.querySelector(".practice-bar-eye-toggle");
      expect(eyeBtn?.getAttribute("aria-pressed")).toBe("false");
      expect(eyeBtn?.querySelector('[data-icon="eye-closed"]')).toBeTruthy();
      expect(eyeBtn?.querySelector('[data-icon="eye-open"]')).toBeNull();
    });

    it("sets data-collapsed='true' on the section when hidden", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, true]],
      );
      const section = container.querySelector("section");
      expect(section?.getAttribute("data-collapsed")).toBe("true");
    });

    it("does not set data-collapsed when visible", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, false]],
      );
      const section = container.querySelector("section");
      expect(section?.getAttribute("data-collapsed")).toBeNull();
    });

    it("collapsing hides the chord-practice-bar-groups section (DegreeChipStrip-style collapse)", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, true]],
      );
      expect(container.querySelector(".chord-practice-bar-groups")).toBeNull();
    });

    it("clicking the eye button toggles chordOverlayHiddenAtom from false to true", () => {
      const store = makeAtomStore([
        [chordOverlayHiddenAtom, false],
        [chordOverlayModeAtom, "manual"],
        [chordRootOverrideAtom, "D"],
        [chordQualityOverrideAtom, "Minor 7th"],
      ]);
      renderWithStore(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        store,
      );
      fireEvent.click(screen.getByRole("button", { name: "Toggle visibility of chord overlay" }));
      expect(store.get(chordOverlayHiddenAtom)).toBe(true);
    });

    it("clicking the eye button toggles chordOverlayHiddenAtom from true to false", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, true]]);
      renderWithStore(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        store,
      );
      fireEvent.click(screen.getByRole("button", { name: "Toggle visibility of chord overlay" }));
      expect(store.get(chordOverlayHiddenAtom)).toBe(false);
    });

    it("clicking a pill toggles only that note in chordHiddenNotesAtom", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      const { container } = renderWithStore(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        store,
      );
      // Click the D pill (chord-root pill in the chord/land-on group)
      const dPill = container.querySelector<HTMLButtonElement>(
        '.practice-bar-pill[data-chord-root="true"]',
      );
      expect(dPill).toBeTruthy();
      fireEvent.click(dPill!);
      expect(store.get(chordHiddenNotesAtom).has("D")).toBe(true);
      // Eye state untouched
      expect(store.get(chordOverlayHiddenAtom)).toBe(false);
    });

    it("clicking a pill again restores that note (toggle off)", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      const { container } = renderWithStore(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        store,
      );
      const dPill = container.querySelector<HTMLButtonElement>(
        '.practice-bar-pill[data-chord-root="true"]',
      );
      expect(dPill).toBeTruthy();
      // First click → hide
      fireEvent.click(dPill!);
      expect(store.get(chordHiddenNotesAtom).has("D")).toBe(true);
      // Aria-label is stable, so click again to toggle off
      fireEvent.click(dPill!);
      expect(store.get(chordHiddenNotesAtom).has("D")).toBe(false);
    });

    it("pill buttons default to aria-pressed=true (note visible) when chord is visible", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, false]],
      );
      const pillButtons = container.querySelectorAll(".practice-bar-pill");
      expect(pillButtons.length).toBeGreaterThan(0);
      for (const pill of pillButtons) {
        expect(pill.getAttribute("aria-pressed")).toBe("true");
      }
    });

    it("pills are not rendered when overlay is collapsed", () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, true]],
      );
      expect(container.querySelectorAll(".practice-bar-pill").length).toBe(0);
    });

    it("after clicking, the pill carries aria-pressed=false (hidden) and data-hidden-note='true'", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      const { container } = renderWithStore(
        <ChordPracticeBar
          title="D Minor 7"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        store,
      );
      const dPill = container.querySelector<HTMLButtonElement>(
        '.practice-bar-pill[data-chord-root="true"]',
      );
      expect(dPill).toBeTruthy();
      fireEvent.click(dPill!);
      const dPillAfter = container.querySelector(
        '.practice-bar-pill[data-chord-root="true"]',
      );
      expect(dPillAfter?.getAttribute("aria-pressed")).toBe("false");
      expect(dPillAfter?.getAttribute("data-hidden-note")).toBe("true");
    });

    it("pills sharing an internalNote across chord and land-on groups toggle together", () => {
      const store = makeAtomStore([[chordOverlayHiddenAtom, false]]);
      const { container } = renderWithStore(
        <ChordPracticeBar
          title="C# Minor"
          chordGroup={cSharpMinorChordGroup}
          landOnGroup={cSharpMinorTensionLandOn}
        />,
        store,
      );
      // Click the C# pill in the chord group; both C# pills (chord + land-on) share internalNote.
      const allPills = container.querySelectorAll<HTMLButtonElement>(
        '.practice-bar-pill[data-chord-root="true"]',
      );
      // C# is chord root in both groups → two pills with data-chord-root="true"
      expect(allPills.length).toBe(2);
      fireEvent.click(allPills[0]!);
      // Both pills should now reflect hidden state
      expect(allPills[0]!.getAttribute("data-hidden-note")).toBe("true");
      expect(allPills[1]!.getAttribute("data-hidden-note")).toBe("true");
      expect(store.get(chordHiddenNotesAtom).has("C#")).toBe(true);
    });

    it("has no a11y violations when visible", async () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          lensLabel="Chord Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, false]],
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no a11y violations when hidden", async () => {
      const { container } = renderWithAtoms(
        <ChordPracticeBar
          title="D Minor 7"
          lensLabel="Chord Tones"
          chordGroup={dmin7ChordGroup}
          landOnGroup={dmin7LandOnGroup}
        />,
        [[chordOverlayHiddenAtom, true]],
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
