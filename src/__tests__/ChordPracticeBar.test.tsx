import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChordPracticeBar } from "../components/ChordPracticeBar";
import type { PracticeBarGroup, PracticeBarNote } from "../core/theory";
import { axe } from "../test-utils/a11y";

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

describe("ChordPracticeBar", () => {
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
});
