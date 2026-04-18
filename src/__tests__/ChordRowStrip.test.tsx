import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChordRowStrip } from "../components/ChordRowStrip";
import type { ChordRowEntry, LegendItem } from "../theory";
import { axe } from "../test-utils/a11y";

const cMajorRow: ChordRowEntry[] = [
  {
    internalNote: "C",
    displayNote: "C",
    memberName: "1",
    role: "chord-root",
    inScale: true,
  },
  {
    internalNote: "E",
    displayNote: "E",
    memberName: "3",
    role: "chord-tone-in-scale",
    inScale: true,
  },
  {
    internalNote: "G",
    displayNote: "G",
    memberName: "5",
    role: "chord-tone-in-scale",
    inScale: true,
  },
];

const withOutsideRow: ChordRowEntry[] = [
  ...cMajorRow,
  {
    internalNote: "A#",
    displayNote: "B♭",
    memberName: "♭7",
    role: "chord-tone-outside-scale",
    inScale: false,
  },
];

const basicLegend: LegendItem[] = [
  { role: "chord-root", label: "Chord root" },
  { role: "chord-tone-in-scale", label: "Chord tone" },
];

const outsideLegend: LegendItem[] = [
  ...basicLegend,
  { role: "chord-tone-outside-scale", label: "Outside scale" },
];

describe("ChordRowStrip", () => {
  it("renders chord label in header", () => {
    render(
      <ChordRowStrip
        chordLabel="C Major Triad"
        chordRow={cMajorRow}
        legendItems={basicLegend}
      />
    );
    expect(screen.getByText("C Major Triad")).toBeTruthy();
  });

  it("renders role=group with correct aria-label", () => {
    render(
      <ChordRowStrip
        chordLabel="C Major Triad"
        chordRow={cMajorRow}
        legendItems={basicLegend}
      />
    );
    const group = screen.getByRole("group", { name: "Chord overlay: C Major Triad" });
    expect(group).toBeTruthy();
  });

  it("renders one chip per chord row entry", () => {
    const { container } = render(
      <ChordRowStrip
        chordLabel="C Major Triad"
        chordRow={cMajorRow}
        legendItems={basicLegend}
      />
    );
    const chips = container.querySelectorAll(".chord-row-item");
    expect(chips).toHaveLength(3);
  });

  it("chord root chip has data-role=chord-root", () => {
    const { container } = render(
      <ChordRowStrip
        chordLabel="C Major Triad"
        chordRow={cMajorRow}
        legendItems={basicLegend}
      />
    );
    const rootChip = container.querySelector('[data-role="chord-root"]');
    expect(rootChip).toBeTruthy();
  });

  it("in-scale chord tones have data-role=chord-tone-in-scale in the chord row list", () => {
    const { container } = render(
      <ChordRowStrip
        chordLabel="C Major Triad"
        chordRow={cMajorRow}
        legendItems={basicLegend}
      />
    );
    const list = container.querySelector(".chord-row-list")!;
    const inScaleChips = list.querySelectorAll('[data-role="chord-tone-in-scale"]');
    expect(inScaleChips).toHaveLength(2);
  });

  it("outside-scale chord tones have data-role=chord-tone-outside-scale in the chord row list", () => {
    const { container } = render(
      <ChordRowStrip
        chordLabel="C Dominant 7th"
        chordRow={withOutsideRow}
        legendItems={outsideLegend}
      />
    );
    const list = container.querySelector(".chord-row-list")!;
    const outsideChips = list.querySelectorAll('[data-role="chord-tone-outside-scale"]');
    expect(outsideChips).toHaveLength(1);
  });

  it("legend items render with correct data-role attributes", () => {
    const { container } = render(
      <ChordRowStrip
        chordLabel="C Dominant 7th"
        chordRow={withOutsideRow}
        legendItems={outsideLegend}
      />
    );
    expect(container.querySelector('.chord-row-legend [data-role="chord-root"]')).toBeTruthy();
    expect(container.querySelector('.chord-row-legend [data-role="chord-tone-in-scale"]')).toBeTruthy();
    expect(container.querySelector('.chord-row-legend [data-role="chord-tone-outside-scale"]')).toBeTruthy();
  });

  it("legend is absent when legendItems is empty", () => {
    const { container } = render(
      <ChordRowStrip
        chordLabel="C Major Triad"
        chordRow={cMajorRow}
        legendItems={[]}
      />
    );
    expect(container.querySelector(".chord-row-legend")).toBeNull();
  });

  it("returns null when both chordRow and legendItems are empty", () => {
    const { container } = render(
      <ChordRowStrip chordLabel="C Major Triad" chordRow={[]} legendItems={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows interval name below each chip", () => {
    render(
      <ChordRowStrip
        chordLabel="C Major Triad"
        chordRow={cMajorRow}
        legendItems={basicLegend}
      />
    );
    expect(screen.getByText("1")).toBeTruthy(); // root → "1"
    expect(screen.getAllByText("3")).toBeTruthy(); // third
    expect(screen.getByText("5")).toBeTruthy(); // fifth
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ChordRowStrip
        chordLabel="C Major Triad"
        chordRow={cMajorRow}
        legendItems={basicLegend}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with outside-scale tones", async () => {
    const { container } = render(
      <ChordRowStrip
        chordLabel="C Dominant 7th"
        chordRow={withOutsideRow}
        legendItems={outsideLegend}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
