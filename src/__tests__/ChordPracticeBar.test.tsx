import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChordPracticeBar } from "../components/ChordPracticeBar";
import type { ChordRowEntry } from "../theory";
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

const allMembers = [root, third, fifth, flatSeven];
const sharedMembers = [root, third, fifth];
const outsideMembers = [flatSeven];

describe("ChordPracticeBar", () => {
  it("renders a role=group with aria-label", () => {
    render(
      <ChordPracticeBar
        title="C Dominant 7th"
        badge="Compare"
        viewMode="compare"
        targetMembers={allMembers}
        sharedMembers={sharedMembers}
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
        sharedMembers={sharedMembers}
        outsideMembers={outsideMembers}
      />
    );
    expect(screen.getByText("C Dominant 7th")).toBeTruthy();
    expect(screen.getByText("Compare")).toBeTruthy();
  });

  describe("compare mode", () => {
    it("shows Targets, Shared, and Outside group labels", () => {
      render(
        <ChordPracticeBar
          title="C Dom7"
          badge="Compare"
          viewMode="compare"
          targetMembers={allMembers}
          sharedMembers={sharedMembers}
          outsideMembers={outsideMembers}
        />
      );
      expect(screen.getByText("Targets")).toBeTruthy();
      expect(screen.getByText("Shared")).toBeTruthy();
      expect(screen.getByText("Outside")).toBeTruthy();
    });

    it("omits Shared group when sharedMembers is empty", () => {
      render(
        <ChordPracticeBar
          title="C Augmented"
          badge="Compare"
          viewMode="compare"
          targetMembers={outsideMembers}
          sharedMembers={[]}
          outsideMembers={outsideMembers}
        />
      );
      expect(screen.queryByText("Shared")).toBeNull();
    });

    it("omits Outside group when outsideMembers is empty", () => {
      render(
        <ChordPracticeBar
          title="C Major Triad"
          badge="Compare"
          viewMode="compare"
          targetMembers={sharedMembers}
          sharedMembers={sharedMembers}
          outsideMembers={[]}
        />
      );
      expect(screen.queryByText("Outside")).toBeNull();
    });
  });

  describe("chord mode", () => {
    it("shows Targets group only", () => {
      render(
        <ChordPracticeBar
          title="C Major Triad"
          badge="Chord only"
          viewMode="chord"
          targetMembers={sharedMembers}
          sharedMembers={sharedMembers}
          outsideMembers={[]}
        />
      );
      expect(screen.getByText("Targets")).toBeTruthy();
      expect(screen.queryByText("Shared")).toBeNull();
      expect(screen.queryByText("Outside")).toBeNull();
    });

    it("renders badge as 'Chord only'", () => {
      render(
        <ChordPracticeBar
          title="C Major Triad"
          badge="Chord only"
          viewMode="chord"
          targetMembers={sharedMembers}
          sharedMembers={sharedMembers}
          outsideMembers={[]}
        />
      );
      expect(screen.getByText("Chord only")).toBeTruthy();
    });
  });

  describe("outside mode", () => {
    it("shows Outside group only", () => {
      render(
        <ChordPracticeBar
          title="Outside tones"
          badge="against C Major"
          viewMode="outside"
          targetMembers={allMembers}
          sharedMembers={sharedMembers}
          outsideMembers={outsideMembers}
        />
      );
      expect(screen.queryByText("Targets")).toBeNull();
      expect(screen.queryByText("Shared")).toBeNull();
      expect(screen.getByText("Outside")).toBeTruthy();
    });

    it("renders title as 'Outside tones'", () => {
      render(
        <ChordPracticeBar
          title="Outside tones"
          badge="against C Major"
          viewMode="outside"
          targetMembers={allMembers}
          sharedMembers={sharedMembers}
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
          sharedMembers={sharedMembers}
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
        sharedMembers={[]}
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
        sharedMembers={sharedMembers}
        outsideMembers={outsideMembers}
      />
    );
    const lists = container.querySelectorAll(".practice-bar-pill-list");
    expect(lists.length).toBeGreaterThan(0);
    // Targets list (first) should have chord-root, chord-tone-in-scale, chord-tone-outside-scale
    const targetList = lists[0]!;
    expect(targetList.querySelector('[data-role="chord-root"]')).toBeTruthy();
    expect(targetList.querySelectorAll('[data-role="chord-tone-in-scale"]').length).toBe(2);
    expect(targetList.querySelector('[data-role="chord-tone-outside-scale"]')).toBeTruthy();
  });

  it("has no accessibility violations in compare mode", async () => {
    const { container } = render(
      <ChordPracticeBar
        title="C Dominant 7th"
        badge="Compare"
        viewMode="compare"
        targetMembers={allMembers}
        sharedMembers={sharedMembers}
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
        targetMembers={sharedMembers}
        sharedMembers={sharedMembers}
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
        sharedMembers={sharedMembers}
        outsideMembers={outsideMembers}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
