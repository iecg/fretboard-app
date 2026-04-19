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
    const activeNotes = document.querySelectorAll(".note-active, .key-tonic");
    expect(activeNotes.length).toBeGreaterThan(0);
  });

  it("classifies scale root with key-tonic class when no chord overlay", () => {
    render(<FretboardSVG {...BASE_PROPS} />);
    const rootNotes = document.querySelectorAll(".key-tonic");
    expect(rootNotes.length).toBeGreaterThan(0);
  });

  it("classifies chord root with chord-root class when chordRoot is passed", () => {
    render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "E", "G"]}
        chordRoot="C"
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
      />
    );
    const chordRootNotes = document.querySelectorAll(".chord-root");
    expect(chordRootNotes.length).toBeGreaterThan(0);
  });

  it("classifies chord tones with chord-tone-in-scale class when chordTones are passed", () => {
    render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "E", "G"]}
        chordRoot="C"
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
      />
    );
    const chordToneNotes = document.querySelectorAll(".chord-tone-in-scale");
    expect(chordToneNotes.length).toBeGreaterThan(0);
  });

  it("chord root (chord-root) is distinct from non-root chord tones (chord-tone-in-scale)", () => {
    const { container } = render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "E", "G"]}
        chordRoot="C"
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
      />
    );
    expect(container.querySelectorAll(".chord-root").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".chord-tone-in-scale").length).toBeGreaterThan(0);
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

  it("hides scale-only circles when hideNonChordNotes is true", () => {
    render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C"]}
        chordRoot="C"
        highlightNotes={["C", "E", "G"]}
        hideNonChordNotes={true}
      />
    );
    // scale-only notes should have the 'hidden' class
    const hiddenNotes = document.querySelectorAll(".scale-only.hidden");
    expect(hiddenNotes.length).toBeGreaterThan(0);
  });

  it("classifies outside-scale chord tones with chord-tone-outside-scale class", () => {
    // E is not in scale (scale=C,E,G highlight) when highlighted=[] for that note
    const { container } = render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "E", "G", "A#"]}
        chordRoot="C"
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
      />
    );
    // A# is a chord tone but not in highlightNotes (scale), so it should be chord-tone-outside-scale
    const outsideTones = container.querySelectorAll(".chord-tone-outside-scale");
    expect(outsideTones.length).toBeGreaterThan(0);
  });

  it("outside view hides in-scale notes and only shows outside chord tones", () => {
    const { container } = render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "A#"]}
        chordRoot="C"
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
        viewMode="outside"
      />
    );
    // C (chord root) is in scale → hidden in outside mode
    const hiddenChordRoot = container.querySelectorAll(".chord-root.hidden");
    expect(hiddenChordRoot.length).toBeGreaterThan(0);
    // A# (outside-scale chord tone) → NOT hidden
    const visibleOutside = container.querySelectorAll(".chord-tone-outside-scale:not(.hidden)");
    expect(visibleOutside.length).toBeGreaterThan(0);
  });

  it("outside view shows outside chord root when it is outside scale", () => {
    // chordRoot=D is not in highlightNotes (C,E,G) → outside scale → visible in outside mode
    const { container } = render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["D", "F#", "A"]}
        chordRoot="D"
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
        viewMode="outside"
      />
    );
    // D (chord root) is outside scale → should appear as chord-root and NOT be hidden
    const visibleChordRoot = container.querySelectorAll(".chord-root:not(.hidden)");
    expect(visibleChordRoot.length).toBeGreaterThan(0);
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

  describe("role-based shapes", () => {
    it("chord-root notes have data-note-shape=squircle", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
        />
      );
      const chordRootNotes = container.querySelectorAll('.chord-root[data-note-shape="squircle"]');
      expect(chordRootNotes.length).toBeGreaterThan(0);
    });

    it("chord-tone-in-scale notes have data-note-shape=squircle", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
        />
      );
      const inScaleTones = container.querySelectorAll('.chord-tone-in-scale[data-note-shape="squircle"]');
      expect(inScaleTones.length).toBeGreaterThan(0);
    });

    it("chord-tone-outside-scale notes have data-note-shape=diamond", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G", "A#"]}
          chordRoot="C"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
        />
      );
      const outsideTones = container.querySelectorAll('.chord-tone-outside-scale[data-note-shape="diamond"]');
      expect(outsideTones.length).toBeGreaterThan(0);
    });

    it("scale-only notes have data-note-shape=circle", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C"]}
          chordRoot="C"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
        />
      );
      const scaleOnly = container.querySelectorAll('.scale-only[data-note-shape="circle"]');
      expect(scaleOnly.length).toBeGreaterThan(0);
    });

    it("note-active notes (no chord overlay) have data-note-shape=circle", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
        />
      );
      const activeNotes = container.querySelectorAll('.note-active[data-note-shape="circle"]');
      expect(activeNotes.length).toBeGreaterThan(0);
    });
  });
});
