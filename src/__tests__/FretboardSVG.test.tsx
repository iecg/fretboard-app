import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FretboardSVG } from "../FretboardSVG";
import { getFretboardNotes } from "../guitar";
import type { CagedShape } from "../shapes";
import { axe } from "../test-utils/a11y";

const STANDARD_TUNING = ["E4", "B3", "G3", "D3", "A2", "E2"];

const BASE_PROPS = {
  effectiveZoom: 49,
  neckWidthPx: 49 * 13,
  startFret: 0,
  endFret: 12,
  stringRowPx: 40,
  fretboardLayout: getFretboardNotes(STANDARD_TUNING, 24),
  tuning: STANDARD_TUNING,
  highlightNotes: ["C", "E", "G"],
  rootNote: "C",
};

describe("FretboardSVG", () => {
  it("renders note circles when highlightNotes are provided", () => {
    render(<FretboardSVG {...BASE_PROPS} />);
    const activeNotes = document.querySelectorAll(".note-active, .root-active");
    expect(activeNotes.length).toBeGreaterThan(0);
  });

  it("classifies root note with root-active class", () => {
    render(<FretboardSVG {...BASE_PROPS} />);
    const rootNotes = document.querySelectorAll(".root-active");
    expect(rootNotes.length).toBeGreaterThan(0);
  });

  it("classifies chord tones with chord-tone class when chordTones are passed", () => {
    render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["E", "G"]}
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
      />
    );
    const chordToneNotes = document.querySelectorAll(".chord-tone");
    expect(chordToneNotes.length).toBeGreaterThan(0);
  });

  it("renders SVG polygon with non-empty points attribute when shapePolygons provided", () => {
    const minimalPolygon = {
      shape: "E" as CagedShape,
      color: "rgba(255,0,0,0.3)",
      cagedLabel: "E",
      modalLabel: "E",
      truncated: false,
      intendedMin: 0,
      intendedMax: 4,
      vertices: [
        { fret: 0, string: 0 },
        { fret: 0, string: 1 },
        { fret: 0, string: 2 },
        { fret: 4, string: 2 },
        { fret: 4, string: 1 },
        { fret: 4, string: 0 },
      ],
    };
    render(<FretboardSVG {...BASE_PROPS} shapePolygons={[minimalPolygon]} />);
    const polygon = document.querySelector("polygon");
    expect(polygon).toBeTruthy();
    expect(polygon?.getAttribute("points")).toBeTruthy();
    expect(polygon?.getAttribute("points")?.length).toBeGreaterThan(0);
  });

  it("renders shape-labels-row when shapeLabels is caged and polygons exist", () => {
    const minimalPolygon = {
      shape: "E" as CagedShape,
      color: "rgba(255,0,0,0.3)",
      cagedLabel: "E",
      modalLabel: "E",
      truncated: false,
      intendedMin: 0,
      intendedMax: 4,
      vertices: [
        { fret: 0, string: 0 },
        { fret: 0, string: 1 },
        { fret: 0, string: 2 },
        { fret: 4, string: 2 },
        { fret: 4, string: 1 },
        { fret: 4, string: 0 },
      ],
    };
    render(
      <FretboardSVG {...BASE_PROPS} shapeLabels="caged" shapePolygons={[minimalPolygon]} />
    );
    const labelsRow = document.querySelector(".shape-labels-row");
    expect(labelsRow).toBeTruthy();
  });

  it("does not render shape-labels-row when shapeLabels is none", () => {
    render(<FretboardSVG {...BASE_PROPS} shapeLabels="none" />);
    const labelsRow = document.querySelector(".shape-labels-row");
    expect(labelsRow).toBeNull();
  });

  it("renders fret number labels for all columns", () => {
    render(<FretboardSVG {...BASE_PROPS} startFret={0} endFret={12} />);
    const fretNumbers = document.querySelectorAll(".fret-number");
    // 13 columns: frets 0-12
    expect(fretNumbers.length).toBe(13);
    expect(fretNumbers[0].textContent).toBe(""); // fret 0 (open string) label intentionally suppressed
    expect(fretNumbers[12].textContent).toBe("12");
  });

  it("does not render note buttons on fret 25", () => {
    render(
      <FretboardSVG
        {...BASE_PROPS}
        fretboardLayout={getFretboardNotes(STANDARD_TUNING, 25)}
        highlightNotes={["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]}
        startFret={24}
        endFret={25}
        maxFret={25}
      />,
    );

    expect(document.querySelector('[aria-label*=", fret 24"]')).toBeTruthy();
    expect(document.querySelector('[aria-label*=", fret 25"]')).toBeNull();
  });

  it("invokes onNoteClick when a note button is clicked", () => {
    const onNoteClick = vi.fn();
    render(<FretboardSVG {...BASE_PROPS} onNoteClick={onNoteClick} />);
    const noteButton = document.querySelector(".note-bubble") as HTMLButtonElement;
    fireEvent.click(noteButton);
    expect(onNoteClick).toHaveBeenCalledTimes(1);
  });

  it("hides note-scale-only circles when hideNonChordNotes is true", () => {
    render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C"]}
        highlightNotes={["C", "E", "G"]}
        hideNonChordNotes={true}
      />
    );
    // scale-only notes should have the 'hidden' class
    const hiddenNotes = document.querySelectorAll(".note-scale-only.hidden");
    expect(hiddenNotes.length).toBeGreaterThan(0);
  });

  it("prefixes SVG defs ids per instance and keeps url references resolvable", () => {
    const { container } = render(
      <>
        <FretboardSVG {...BASE_PROPS} />
        <FretboardSVG {...BASE_PROPS} />
      </>,
    );

    const defsIds = Array.from(container.querySelectorAll("defs [id]")).map(
      (node) => node.id,
    );
    expect(new Set(defsIds).size).toBe(defsIds.length);

    const urlRefAttributes = ["fill", "filter", "clip-path"] as const;
    for (const attribute of urlRefAttributes) {
      const nodes = container.querySelectorAll(`[${attribute}^="url(#"]`);
      for (const node of nodes) {
        const value = node.getAttribute(attribute);
        const refId = value?.match(/^url\(#(.+)\)$/)?.[1];
        expect(refId).toBeTruthy();
        expect(defsIds).toContain(refId);
      }
    }
  });

  it("has no a11y violations", async () => {
    const { container } = render(<FretboardSVG {...BASE_PROPS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
