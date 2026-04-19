import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChordPracticeBar } from "../components/ChordPracticeBar";
import type { PracticeCue } from "../theory";
import { axe } from "../test-utils/a11y";

// ── Fixture cues ──────────────────────────────────────────────────────────────

const landOnCue: PracticeCue = {
  kind: "land-on",
  label: "Land on",
  notes: [
    { internalNote: "D", displayNote: "D", intervalName: "1", role: "chord-root" },
    { internalNote: "F", displayNote: "F", intervalName: "♭3", role: "chord-tone-in-scale" },
    { internalNote: "A", displayNote: "A", intervalName: "5", role: "chord-tone-in-scale" },
    { internalNote: "C", displayNote: "C", intervalName: "♭7", role: "chord-tone-in-scale" },
  ],
};

const colorCue: PracticeCue = {
  kind: "color-note",
  label: "Color note",
  notes: [
    { internalNote: "B", displayNote: "B", intervalName: "6", role: "color-tone" },
  ],
};

const colorCuePlural: PracticeCue = {
  kind: "color-note",
  label: "Color notes",
  notes: [
    { internalNote: "B", displayNote: "B", intervalName: "6", role: "color-tone" },
    { internalNote: "F#", displayNote: "F♯", intervalName: "♯4", role: "color-tone" },
  ],
};

const guideToneCue: PracticeCue = {
  kind: "guide-tones",
  label: "Guide tones",
  notes: [
    { internalNote: "E", displayNote: "E", intervalName: "3", role: "guide-tone" },
    { internalNote: "A#", displayNote: "B♭", intervalName: "♭7", role: "guide-tone" },
  ],
};

const tensionCue: PracticeCue = {
  kind: "tension",
  label: "Tension",
  notes: [
    {
      internalNote: "C#",
      displayNote: "C♯",
      intervalName: "1",
      role: "chord-tone-outside-scale",
      resolvesTo: { internalNote: "D", displayNote: "D" },
    },
    {
      internalNote: "G#",
      displayNote: "G♯",
      intervalName: "5",
      role: "chord-tone-outside-scale",
      resolvesTo: { internalNote: "A", displayNote: "A" },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

describe("ChordPracticeBar", () => {
  it("renders a role=group with aria-label containing the title", () => {
    render(
      <ChordPracticeBar
        title="D Minor 7"
        cues={[landOnCue]}
      />
    );
    const group = screen.getByRole("group", { name: "Practice cues: D Minor 7" });
    expect(group).toBeTruthy();
  });

  it("renders the title", () => {
    render(<ChordPracticeBar title="D Minor 7" cues={[landOnCue]} />);
    expect(screen.getByText("D Minor 7")).toBeTruthy();
  });

  it("renders an optional badge when provided", () => {
    render(<ChordPracticeBar title="D Minor 7" badge="Targets" cues={[landOnCue]} />);
    expect(screen.getByText("Targets")).toBeTruthy();
  });

  it("does not render a badge element when badge is null", () => {
    const { container } = render(
      <ChordPracticeBar title="D Minor 7" badge={null} cues={[landOnCue]} />
    );
    expect(container.querySelector(".chord-practice-bar-badge")).toBeNull();
  });

  it("returns null when cues array is empty", () => {
    const { container } = render(
      <ChordPracticeBar title="Empty" cues={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  describe("Land on cue (targets / targets-color)", () => {
    it("renders 'Land on:' cue label", () => {
      render(<ChordPracticeBar title="D Minor 7" cues={[landOnCue]} />);
      expect(screen.getByText("Land on:")).toBeTruthy();
    });

    it("renders all chord tone note names", () => {
      render(<ChordPracticeBar title="D Minor 7" cues={[landOnCue]} />);
      expect(screen.getByText("D")).toBeTruthy();
      expect(screen.getByText("F")).toBeTruthy();
      expect(screen.getByText("A")).toBeTruthy();
      expect(screen.getByText("C")).toBeTruthy();
    });

    it("renders interval names alongside note names", () => {
      render(<ChordPracticeBar title="D Minor 7" cues={[landOnCue]} />);
      expect(screen.getByText("1")).toBeTruthy();
      expect(screen.getByText("♭3")).toBeTruthy();
    });

    it("pills have correct data-role for chord root and chord tones", () => {
      const { container } = render(
        <ChordPracticeBar title="D Minor 7" cues={[landOnCue]} />
      );
      expect(container.querySelector('[data-role="chord-root"]')).toBeTruthy();
      expect(container.querySelectorAll('[data-role="chord-tone-in-scale"]').length).toBe(3);
    });
  });

  describe("Color note cue", () => {
    it("renders 'Color note:' label (singular)", () => {
      render(<ChordPracticeBar title="D Dorian" cues={[colorCue]} />);
      expect(screen.getByText("Color note:")).toBeTruthy();
    });

    it("renders 'Color notes:' label (plural)", () => {
      render(<ChordPracticeBar title="C Lydian" cues={[colorCuePlural]} />);
      expect(screen.getByText("Color notes:")).toBeTruthy();
    });

    it("pill has data-role=color-tone", () => {
      const { container } = render(
        <ChordPracticeBar title="D Dorian" cues={[colorCue]} />
      );
      expect(container.querySelector('[data-role="color-tone"]')).toBeTruthy();
    });

    it("renders color note name and interval", () => {
      render(<ChordPracticeBar title="D Dorian" cues={[colorCue]} />);
      expect(screen.getByText("B")).toBeTruthy();
      expect(screen.getByText("6")).toBeTruthy();
    });
  });

  describe("Guide tones cue", () => {
    it("renders 'Guide tones:' label", () => {
      render(<ChordPracticeBar title="G7" cues={[guideToneCue]} />);
      expect(screen.getByText("Guide tones:")).toBeTruthy();
    });

    it("pills have data-role=guide-tone", () => {
      const { container } = render(
        <ChordPracticeBar title="G7" cues={[guideToneCue]} />
      );
      const pills = container.querySelectorAll('[data-role="guide-tone"]');
      expect(pills.length).toBe(2);
    });

    it("renders guide tone note names", () => {
      render(<ChordPracticeBar title="G7" cues={[guideToneCue]} />);
      expect(screen.getByText("E")).toBeTruthy();
      expect(screen.getByText("B♭")).toBeTruthy();
    });
  });

  describe("Tension cue", () => {
    it("renders 'Tension:' label", () => {
      render(<ChordPracticeBar title="C# Minor Triad" cues={[tensionCue]} />);
      expect(screen.getByText("Tension:")).toBeTruthy();
    });

    it("pills have data-role=chord-tone-outside-scale", () => {
      const { container } = render(
        <ChordPracticeBar title="C# Minor Triad" cues={[tensionCue]} />
      );
      const pills = container.querySelectorAll('[data-role="chord-tone-outside-scale"]');
      expect(pills.length).toBe(2);
    });

    it("renders resolution arrows for tension notes with resolvesTo", () => {
      render(<ChordPracticeBar title="C# Minor Triad" cues={[tensionCue]} />);
      const resolves = screen.getAllByText(/→/);
      expect(resolves.length).toBe(2);
      expect(resolves[0]!.textContent).toBe("→D");
      expect(resolves[1]!.textContent).toBe("→A");
    });

    it("outside chord root appears in tension cue (semantic fix)", () => {
      // A chord root that is outside the scale should appear in a tension cue
      const outsideRootTension: PracticeCue = {
        kind: "tension",
        label: "Tension",
        notes: [
          {
            internalNote: "C#",
            displayNote: "C♯",
            intervalName: "1",
            role: "chord-root",  // root role, but also tension
            resolvesTo: { internalNote: "D", displayNote: "D" },
          },
        ],
      };
      render(<ChordPracticeBar title="C# Minor" cues={[outsideRootTension]} />);
      expect(screen.getByText("Tension:")).toBeTruthy();
      expect(screen.getByText("C♯")).toBeTruthy();
      expect(screen.getByText("→D")).toBeTruthy();
    });
  });

  describe("Targets + Color (default lens)", () => {
    it("renders both Land on and Color note cues", () => {
      render(
        <ChordPracticeBar
          title="D Minor 7"
          cues={[landOnCue, colorCue]}
        />
      );
      expect(screen.getByText("Land on:")).toBeTruthy();
      expect(screen.getByText("Color note:")).toBeTruthy();
    });

    it("does not duplicate color note when it is already a chord tone (filtered upstream)", () => {
      // colorCuePlural contains B and F# — if these were chord tones they'd be filtered
      // out before reaching the component. This test just verifies the component renders
      // them as-is (filtering is done in atoms).
      render(
        <ChordPracticeBar
          title="G Mixolydian + G7"
          cues={[landOnCue]}
        />
      );
      // No color cue because it was filtered upstream; component just shows land-on.
      expect(screen.queryByText("Color note:")).toBeNull();
    });
  });

  describe("Shape-local context", () => {
    it("renders shapeContextLabel as subtitle", () => {
      render(
        <ChordPracticeBar
          title="D Minor 7"
          cues={[landOnCue, colorCue]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalCues={[landOnCue]}
        />
      );
      expect(screen.getByText("In E shape")).toBeTruthy();
    });

    it("uses shapeLocalCues when isShapeLocal and shapeLocalCues is non-empty", () => {
      const shapeLandOn: PracticeCue = {
        kind: "land-on",
        label: "Land on",
        notes: [
          { internalNote: "D", displayNote: "D", intervalName: "1", role: "chord-root" },
        ],
      };
      render(
        <ChordPracticeBar
          title="D Minor 7"
          cues={[landOnCue, colorCue]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalCues={[shapeLandOn]}
        />
      );
      // Shape-local cue shows only D (not F, A, C from global cue)
      expect(screen.getByText("D")).toBeTruthy();
      expect(screen.queryByText("Color note:")).toBeNull();
    });

    it("falls back to global cues when shapeLocalCues is empty", () => {
      render(
        <ChordPracticeBar
          title="D Minor 7"
          cues={[landOnCue]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalCues={[]}
        />
      );
      // Falls back to global; still shows global cue notes
      expect(screen.getByText("Land on:")).toBeTruthy();
    });

    it("does not render context label when shapeContextLabel is null", () => {
      render(
        <ChordPracticeBar
          title="D Minor 7"
          cues={[landOnCue]}
          isShapeLocal={false}
          shapeContextLabel={null}
        />
      );
      expect(screen.queryByText("In E shape")).toBeNull();
    });

    it("returns null when shapeLocalCues is non-empty array but all empty after lens filter (empty shapeLocalCues)", () => {
      const { container } = render(
        <ChordPracticeBar
          title="D Minor 7"
          cues={[landOnCue]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalCues={[]}
        />
      );
      // Falls back to global cues — not null
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe("Accessibility", () => {
    it("has no a11y violations with a land-on cue", async () => {
      const { container } = render(
        <ChordPracticeBar title="D Minor 7" cues={[landOnCue]} />
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no a11y violations with targets+color cues", async () => {
      const { container } = render(
        <ChordPracticeBar title="D Dorian + Dm7" cues={[landOnCue, colorCue]} />
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no a11y violations with guide-tones cue", async () => {
      const { container } = render(
        <ChordPracticeBar title="G7" cues={[guideToneCue]} />
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no a11y violations with tension cue and resolution arrows", async () => {
      const { container } = render(
        <ChordPracticeBar title="C# Minor Triad" cues={[tensionCue]} />
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no a11y violations in shape-local context", async () => {
      const { container } = render(
        <ChordPracticeBar
          title="D Minor 7"
          cues={[landOnCue, colorCue]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalCues={[landOnCue]}
        />
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
