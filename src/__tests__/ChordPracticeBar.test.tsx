import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChordPracticeBar } from "../components/ChordPracticeBar";
import type { ChordRowEntry, PracticeBarColorNote } from "../theory";
import { axe } from "../test-utils/a11y";

const root: ChordRowEntry = {
  internalNote: "C",
  displayNote: "C",
  memberName: "1",
  role: "chord-root",
  inScale: true,
};
const third: ChordRowEntry = {
  internalNote: "E",
  displayNote: "E",
  memberName: "3",
  role: "chord-tone-in-scale",
  inScale: true,
};
const fifth: ChordRowEntry = {
  internalNote: "G",
  displayNote: "G",
  memberName: "5",
  role: "chord-tone-in-scale",
  inScale: true,
};
const flatSeven: ChordRowEntry = {
  internalNote: "A#",
  displayNote: "B♭",
  memberName: "♭7",
  role: "chord-tone-outside-scale",
  inScale: false,
};

const bNatural: PracticeBarColorNote = {
  internalNote: "B",
  displayNote: "B",
  intervalName: "6",
};
const fSharp: PracticeBarColorNote = {
  internalNote: "F#",
  displayNote: "F♯",
  intervalName: "♯4",
};

const allMembers = [root, third, fifth, flatSeven];
const inScaleMembers = [root, third, fifth];
const outsideMembers = [flatSeven];

describe("ChordPracticeBar", () => {
  it("renders a role=group with aria-label", () => {
    render(
      <ChordPracticeBar
        title="C Dominant 7th"
        badge="Compare"
        viewMode="compare"
        targetMembers={allMembers}
        outsideMembers={outsideMembers}
      />
    );
    const group = screen.getByRole("group", { name: "Chord analysis: C Dominant 7th" });
    expect(group).toBeTruthy();
  });

  it("renders title and badge", () => {
    render(
      <ChordPracticeBar
        title="C Dominant 7th"
        badge="Compare"
        viewMode="compare"
        targetMembers={allMembers}
        outsideMembers={outsideMembers}
      />
    );
    expect(screen.getByText("C Dominant 7th")).toBeTruthy();
    expect(screen.getByText("Compare")).toBeTruthy();
  });

  describe("compare mode", () => {
    it("shows Targets and Outside group labels (no Shared)", () => {
      render(
        <ChordPracticeBar
          title="C Dom7"
          badge="Compare"
          viewMode="compare"
          targetMembers={allMembers}
          outsideMembers={outsideMembers}
        />
      );
      expect(screen.getByText("Targets")).toBeTruthy();
      expect(screen.queryByText("Shared")).toBeNull();
      expect(screen.getByText("Outside")).toBeTruthy();
    });

    it("omits Outside group when outsideMembers is empty", () => {
      render(
        <ChordPracticeBar
          title="C Major Triad"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
        />
      );
      expect(screen.queryByText("Outside")).toBeNull();
    });

    it("shows Color tone group (singular) when one colorNoteEntry provided", () => {
      render(
        <ChordPracticeBar
          title="D Dorian + Dm7"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          colorNoteEntries={[bNatural]}
        />
      );
      expect(screen.getByText("Color tone")).toBeTruthy();
      expect(screen.queryByText("Color tones")).toBeNull();
    });

    it("shows Color tones group (plural) when multiple colorNoteEntries provided", () => {
      render(
        <ChordPracticeBar
          title="C Lydian + CMaj7"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          colorNoteEntries={[bNatural, fSharp]}
        />
      );
      expect(screen.getByText("Color tones")).toBeTruthy();
      expect(screen.queryByText("Color tone")).toBeNull();
    });

    it("color pill has data-role=color-tone", () => {
      const { container } = render(
        <ChordPracticeBar
          title="D Dorian + Dm7"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          colorNoteEntries={[bNatural]}
        />
      );
      expect(container.querySelector('[data-role="color-tone"]')).toBeTruthy();
    });

    it("color pill shows note name and interval", () => {
      render(
        <ChordPracticeBar
          title="D Dorian + Dm7"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          colorNoteEntries={[bNatural]}
        />
      );
      expect(screen.getByText("B")).toBeTruthy();
      expect(screen.getByText("6")).toBeTruthy();
    });
  });

  describe("chord mode", () => {
    it("shows Targets group only, no Shared or Outside or Color tone", () => {
      render(
        <ChordPracticeBar
          title="C Major Triad"
          badge="Chord only"
          viewMode="chord"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          colorNoteEntries={[bNatural]}
        />
      );
      expect(screen.getByText("Targets")).toBeTruthy();
      expect(screen.queryByText("Shared")).toBeNull();
      expect(screen.queryByText("Outside")).toBeNull();
      expect(screen.queryByText("Color tone")).toBeNull();
      expect(screen.queryByText("Color tones")).toBeNull();
    });

    it("renders badge as 'Chord only'", () => {
      render(
        <ChordPracticeBar
          title="C Major Triad"
          badge="Chord only"
          viewMode="chord"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
        />
      );
      expect(screen.getByText("Chord only")).toBeTruthy();
    });
  });

  describe("outside mode", () => {
    it("shows Outside group only, no Targets or Color tone", () => {
      render(
        <ChordPracticeBar
          title="Outside tones"
          badge="against C Major"
          viewMode="outside"
          targetMembers={allMembers}
          outsideMembers={outsideMembers}
          colorNoteEntries={[bNatural]}
        />
      );
      expect(screen.queryByText("Targets")).toBeNull();
      expect(screen.queryByText("Shared")).toBeNull();
      expect(screen.getByText("Outside")).toBeTruthy();
      expect(screen.queryByText("Color tone")).toBeNull();
      expect(screen.queryByText("Color tones")).toBeNull();
    });

    it("renders title as 'Outside tones'", () => {
      render(
        <ChordPracticeBar
          title="Outside tones"
          badge="against C Major"
          viewMode="outside"
          targetMembers={allMembers}
          outsideMembers={outsideMembers}
        />
      );
      expect(screen.getByText("Outside tones")).toBeTruthy();
    });

    it("renders badge as 'against {scale}'", () => {
      render(
        <ChordPracticeBar
          title="Outside tones"
          badge="against C Major"
          viewMode="outside"
          targetMembers={allMembers}
          outsideMembers={outsideMembers}
        />
      );
      expect(screen.getByText("against C Major")).toBeTruthy();
    });
  });

  it("returns null when all member arrays are empty", () => {
    const { container } = render(
      <ChordPracticeBar
        title="Empty"
        badge={null}
        viewMode="compare"
        targetMembers={[]}
        outsideMembers={[]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("pills have data-role attributes matching chord member roles", () => {
    const { container } = render(
      <ChordPracticeBar
        title="C Dom7"
        badge="Compare"
        viewMode="compare"
        targetMembers={allMembers}
        outsideMembers={outsideMembers}
      />
    );
    const lists = container.querySelectorAll(".practice-bar-pill-list");
    expect(lists.length).toBeGreaterThan(0);
    const targetList = lists[0]!;
    expect(targetList.querySelector('[data-role="chord-root"]')).toBeTruthy();
    expect(targetList.querySelectorAll('[data-role="chord-tone-in-scale"]').length).toBe(2);
    expect(targetList.querySelector('[data-role="chord-tone-outside-scale"]')).toBeTruthy();
  });

  describe("shape-local context", () => {
    it("shows 'Targets here' label when isShapeLocal and shapeLocalTargetMembers provided", () => {
      render(
        <ChordPracticeBar
          title="D Minor 7"
          badge="Compare"
          viewMode="compare"
          targetMembers={allMembers}
          outsideMembers={[]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalTargetMembers={inScaleMembers}
          shapeLocalOutsideMembers={[]}
        />
      );
      expect(screen.getByText("Targets here")).toBeTruthy();
      expect(screen.queryByText("Targets")).toBeNull();
    });

    it("shows 'Outside here' label when isShapeLocal and shapeLocalOutsideMembers provided", () => {
      render(
        <ChordPracticeBar
          title="C# Minor Triad"
          badge="Compare"
          viewMode="compare"
          targetMembers={allMembers}
          outsideMembers={outsideMembers}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalTargetMembers={[]}
          shapeLocalOutsideMembers={outsideMembers}
        />
      );
      expect(screen.getByText("Outside here")).toBeTruthy();
    });

    it("shows 'Color tone here' (singular) when isShapeLocal and one shape-local color entry", () => {
      render(
        <ChordPracticeBar
          title="D Dorian + Dm7"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          colorNoteEntries={[bNatural]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalTargetMembers={inScaleMembers}
          shapeLocalOutsideMembers={[]}
          shapeLocalColorNoteEntries={[bNatural]}
        />
      );
      expect(screen.getByText("Color tone here")).toBeTruthy();
    });

    it("shows 'Color tones here' (plural) when isShapeLocal and multiple shape-local color entries", () => {
      render(
        <ChordPracticeBar
          title="C Lydian + CMaj7"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          colorNoteEntries={[bNatural, fSharp]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalTargetMembers={inScaleMembers}
          shapeLocalOutsideMembers={[]}
          shapeLocalColorNoteEntries={[bNatural, fSharp]}
        />
      );
      expect(screen.getByText("Color tones here")).toBeTruthy();
    });

    it("renders context label as subtitle when provided", () => {
      render(
        <ChordPracticeBar
          title="D Minor 7"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalTargetMembers={inScaleMembers}
          shapeLocalOutsideMembers={[]}
        />
      );
      expect(screen.getByText("In E shape")).toBeTruthy();
    });

    it("does not render context label element when shapeContextLabel is null", () => {
      render(
        <ChordPracticeBar
          title="D Minor 7"
          badge="Compare"
          viewMode="compare"
          targetMembers={inScaleMembers}
          outsideMembers={[]}
          isShapeLocal={false}
          shapeContextLabel={null}
          shapeLocalTargetMembers={inScaleMembers}
          shapeLocalOutsideMembers={[]}
        />
      );
      expect(screen.queryByText("In E shape")).toBeNull();
    });

    it("uses global labels when isShapeLocal is false even with shapeLocal arrays provided", () => {
      render(
        <ChordPracticeBar
          title="C Dom7"
          badge="Compare"
          viewMode="compare"
          targetMembers={allMembers}
          outsideMembers={outsideMembers}
          isShapeLocal={false}
          shapeLocalTargetMembers={inScaleMembers}
          shapeLocalOutsideMembers={[]}
        />
      );
      expect(screen.getByText("Targets")).toBeTruthy();
      expect(screen.queryByText("Targets here")).toBeNull();
    });

    it("omits empty Targets here group when shape-local targets is empty", () => {
      render(
        <ChordPracticeBar
          title="C# Minor Triad"
          badge="Compare"
          viewMode="compare"
          targetMembers={allMembers}
          outsideMembers={outsideMembers}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalTargetMembers={[]}
          shapeLocalOutsideMembers={outsideMembers}
        />
      );
      expect(screen.queryByText("Targets here")).toBeNull();
    });

    it("returns null when all shape-local effective arrays are empty", () => {
      const { container } = render(
        <ChordPracticeBar
          title="C# Minor Triad"
          badge="Compare"
          viewMode="compare"
          targetMembers={allMembers}
          outsideMembers={outsideMembers}
          isShapeLocal
          shapeContextLabel="In E shape"
          shapeLocalTargetMembers={[]}
          shapeLocalOutsideMembers={[]}
          shapeLocalColorNoteEntries={[]}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  it("has no accessibility violations in compare mode", async () => {
    const { container } = render(
      <ChordPracticeBar
        title="C Dominant 7th"
        badge="Compare"
        viewMode="compare"
        targetMembers={allMembers}
        outsideMembers={outsideMembers}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations in chord mode", async () => {
    const { container } = render(
      <ChordPracticeBar
        title="C Major Triad"
        badge="Chord only"
        viewMode="chord"
        targetMembers={inScaleMembers}
        outsideMembers={[]}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations in outside mode", async () => {
    const { container } = render(
      <ChordPracticeBar
        title="Outside tones"
        badge="against C Major"
        viewMode="outside"
        targetMembers={allMembers}
        outsideMembers={outsideMembers}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with color tones", async () => {
    const { container } = render(
      <ChordPracticeBar
        title="D Dorian + Dm7"
        badge="Compare"
        viewMode="compare"
        targetMembers={inScaleMembers}
        outsideMembers={[]}
        colorNoteEntries={[bNatural]}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations in shape-local context", async () => {
    const { container } = render(
      <ChordPracticeBar
        title="D Minor 7"
        badge="Compare"
        viewMode="compare"
        targetMembers={inScaleMembers}
        outsideMembers={[]}
        colorNoteEntries={[bNatural]}
        isShapeLocal
        shapeContextLabel="In E shape"
        shapeLocalTargetMembers={inScaleMembers}
        shapeLocalOutsideMembers={[]}
        shapeLocalColorNoteEntries={[bNatural]}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
