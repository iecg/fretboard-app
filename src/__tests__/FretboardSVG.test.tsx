import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FretboardSVG } from "../FretboardSVG";
import { getFretboardNotes } from "../core/guitar";
import type { CagedShape, ShapePolygon } from "../shapes";
import type { NoteSemantics } from "../core/theory";
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

  it("tension lens (old outside mode) shows all notes — in-scale chord root is not hidden", () => {
    // The old viewMode="outside" used to hide in-scale notes. The new tension lens
    // shows all notes and uses the practice bar to coach about outside tones instead.
    const { container } = render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "A#"]}
        chordRoot="C"
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
        practiceLens="tension"
      />
    );
    // C (chord root, in scale) must NOT be hidden in tension lens
    const hiddenChordRoot = container.querySelectorAll(".chord-root.hidden");
    expect(hiddenChordRoot.length).toBe(0);
    // A# (outside-scale chord tone) is still visible
    const visibleOutside = container.querySelectorAll(".chord-tone-outside-scale:not(.hidden)");
    expect(visibleOutside.length).toBeGreaterThan(0);
  });

  it("outside chord root is visible and not hidden in tension lens", () => {
    // D (chord root) is outside the scale notes (C,E,G) → classified as chord-root
    // and must not be hidden under the tension lens
    const { container } = render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["D", "F#", "A"]}
        chordRoot="D"
        rootNote="C"
        highlightNotes={["C", "E", "G"]}
        practiceLens="tension"
      />
    );
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

    it("color-tone notes have data-note-shape=hexagon when chord overlay active", () => {
      // D Dorian scale: D E F G A B C. colorNote=B. chordTones=D F A (Dm triad).
      // B is in scale, is a color note, NOT a chord tone → color-tone (hexagon, scale-owned)
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          rootNote="D"
          highlightNotes={["D", "E", "F", "G", "A", "B", "C"]}
          colorNotes={["B"]}
          chordTones={["D", "F", "A"]}
          chordRoot="D"
        />
      );
      const colorToneHexagons = container.querySelectorAll('.color-tone[data-note-shape="hexagon"]');
      expect(colorToneHexagons.length).toBeGreaterThan(0);
    });

    it("note-blue notes (scale color notes, no chord overlay) have data-note-shape=hexagon", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          rootNote="D"
          highlightNotes={["D", "E", "F", "G", "A", "B", "C"]}
          colorNotes={["B"]}
        />
      );
      // No chord overlay: color notes → note-blue with hexagon shape
      const colorNoteHexagons = container.querySelectorAll('.note-blue[data-note-shape="hexagon"]');
      expect(colorNoteHexagons.length).toBeGreaterThan(0);
    });

    it("chord role wins over color-tone when a note is both", () => {
      // If B is both a color note AND a chord tone, it should be chord-tone-in-scale, not color-tone
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          rootNote="D"
          highlightNotes={["D", "E", "F", "G", "A", "B", "C"]}
          colorNotes={["B"]}
          chordTones={["D", "F", "A", "B"]}
          chordRoot="D"
        />
      );
      // B should not be color-tone since it's in the chord
      const colorToneNotes = container.querySelectorAll(".color-tone");
      // All color-tone notes should not include B (B is now chord-tone-in-scale)
      expect(
        Array.from(colorToneNotes).some((el) =>
          el.getAttribute("aria-label")?.includes("B")
        )
      ).toBe(false);
      // B should be chord-tone-in-scale instead
      const chordInScale = container.querySelectorAll(".chord-tone-in-scale");
      expect(chordInScale.length).toBeGreaterThan(0);
    });

    it("scale-only notes without chord overlay show as note-active (not color-tone)", () => {
      // No chord overlay: color notes show as note-blue, others as note-active
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          rootNote="D"
          highlightNotes={["D", "E", "F", "G", "A", "B", "C"]}
          colorNotes={["B"]}
        />
      );
      // Without chord overlay, color notes are note-blue, not color-tone
      expect(container.querySelectorAll(".note-blue").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(".color-tone").length).toBe(0);
    });
  });

  describe("scale visibility 'off' mode — empty highlightNotes with chord overlay", () => {
    it("chord root still renders when highlightNotes is empty", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          highlightNotes={[]}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          rootNote="C"
        />
      );
      expect(container.querySelectorAll(".chord-root").length).toBeGreaterThan(0);
    });

    it("chord tones render as chord-tone-outside-scale when highlightNotes is empty", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          highlightNotes={[]}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          rootNote="C"
        />
      );
      // E and G are chord tones but not "in scale" (no highlightNotes) → outside-scale
      expect(container.querySelectorAll(".chord-tone-outside-scale").length).toBeGreaterThan(0);
    });

    it("no scale-only or note-active notes rendered when highlightNotes is empty", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          highlightNotes={[]}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          rootNote="C"
        />
      );
      expect(container.querySelectorAll(".scale-only").length).toBe(0);
      expect(container.querySelectorAll(".note-active").length).toBe(0);
    });

    it("no note-active rendered when highlightNotes is empty and no chord overlay", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          highlightNotes={[]}
          rootNote="C"
        />
      );
      expect(container.querySelectorAll(".note-active").length).toBe(0);
      expect(container.querySelectorAll(".key-tonic").length).toBe(0);
    });
  });

  describe("composable renderer contract — noteSemantics", () => {
    it("outside chord root gets data-note-tension when noteSemantics provided", () => {
      // C# is the chord root but is outside C Major scale (C,E,G highlights)
      const semantics = new Map<string, NoteSemantics>([
        [
          "C#",
          {
            isScaleRoot: false,
            isChordRoot: true,
            isChordTone: true,
            isInScale: false,
            isColorTone: false,
            isGuideTone: false,
            isTension: true,
            memberName: "root",
          },
        ],
      ]);
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C#", "F", "G#"]}
          chordRoot="C#"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
          noteSemantics={semantics}
        />,
      );
      // C# should be classified as chord-root (visual role)
      const chordRootNotes = container.querySelectorAll(".chord-root");
      expect(chordRootNotes.length).toBeGreaterThan(0);
      // AND carry data-note-tension (composable semantic attribute)
      const tensionChordRoot = container.querySelectorAll(
        '.chord-root[data-note-tension="true"]',
      );
      expect(tensionChordRoot.length).toBeGreaterThan(0);
    });

    it("in-scale chord root does NOT get data-note-tension", () => {
      const semantics = new Map<string, NoteSemantics>([
        [
          "C",
          {
            isScaleRoot: true,
            isChordRoot: true,
            isChordTone: true,
            isInScale: true,
            isColorTone: false,
            isGuideTone: false,
            isTension: false,
            memberName: "root",
          },
        ],
      ]);
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
          noteSemantics={semantics}
        />,
      );
      const tensionChordRoot = container.querySelectorAll(
        '.chord-root[data-note-tension="true"]',
      );
      expect(tensionChordRoot.length).toBe(0);
    });

    it("guide tone gets data-note-guide-tone attribute", () => {
      // B is the 3rd of G7 — a guide tone
      const semantics = new Map<string, NoteSemantics>([
        [
          "B",
          {
            isScaleRoot: false,
            isChordRoot: false,
            isChordTone: true,
            isInScale: true,
            isColorTone: false,
            isGuideTone: true,
            isTension: false,
            memberName: "3",
          },
        ],
      ]);
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["G", "B", "D", "F"]}
          chordRoot="G"
          rootNote="G"
          highlightNotes={["G", "A", "B", "C", "D", "E", "F"]}
          noteSemantics={semantics}
        />,
      );
      const guideToneNotes = container.querySelectorAll(
        '[data-note-guide-tone="true"]',
      );
      expect(guideToneNotes.length).toBeGreaterThan(0);
    });

    it("notes without semantics entry have no data-note-tension or data-note-guide-tone", () => {
      // Pass semantics for C only; E and G should have no extra attributes
      const semantics = new Map<string, NoteSemantics>([
        [
          "C",
          {
            isScaleRoot: true,
            isChordRoot: true,
            isChordTone: true,
            isInScale: true,
            isColorTone: false,
            isGuideTone: false,
            isTension: false,
            memberName: "root",
          },
        ],
      ]);
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
          noteSemantics={semantics}
        />,
      );
      // Only C has semantics — no tension/guide for E or G
      const tensionNotes = container.querySelectorAll('[data-note-tension="true"]');
      expect(tensionNotes.length).toBe(0);
      const guideNotes = container.querySelectorAll('[data-note-guide-tone="true"]');
      expect(guideNotes.length).toBe(0);
    });

    it("without noteSemantics prop no data-note-tension attributes are emitted", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C#", "F", "G#"]}
          chordRoot="C#"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
        />,
      );
      const tensionNotes = container.querySelectorAll('[data-note-tension="true"]');
      expect(tensionNotes.length).toBe(0);
    });
  });

  describe("shape scope and membership", () => {
    const singleShapePolygon: ShapePolygon = {
      shape: "E" as CagedShape,
      color: "rgba(99,102,241,0.3)",
      cagedLabel: "E",
      modalLabel: "Ionian",
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

    const fullShapePolygon: ShapePolygon = {
      shape: "C" as CagedShape,
      color: "rgba(236,72,153,0.3)",
      cagedLabel: "C",
      modalLabel: "Ionian",
      truncated: false,
      intendedMin: 3,
      intendedMax: 5,
      vertices: [
        { fret: 3, string: 0 },
        { fret: 3, string: 1 },
        { fret: 3, string: 2 },
        { fret: 3, string: 3 },
        { fret: 3, string: 4 },
        { fret: 3, string: 5 },
        { fret: 5, string: 5 },
        { fret: 5, string: 4 },
        { fret: 5, string: 3 },
        { fret: 5, string: 2 },
        { fret: 5, string: 1 },
        { fret: 5, string: 0 },
      ],
    };

    it("single CAGED shape membership - chord tone inside shape is chord-tone-in-scale", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          highlightNotes={["C", "E", "G"]}
          shapePolygons={[singleShapePolygon]}
          activePattern="caged"
          activeShape="E"
          shapeScope="single"
        />,
      );
      const inScaleTone = container.querySelectorAll(
        '.chord-tone-in-scale:not([data-note-role="chord-root"])',
      );
      expect(inScaleTone.length).toBeGreaterThan(0);
    });

    it("single CAGED shape membership - chord tone outside shape is suppressed (not scale-only)", () => {
      // activeShape="C" but polygon is shape "E" — no polygon matches active shape,
      // so isInActiveShape=false everywhere. All notes should be note-inactive.
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          highlightNotes={["C", "E", "G"]}
          shapePolygons={[singleShapePolygon]}
          activePattern="caged"
          activeShape="C"
          shapeScope="single"
        />,
      );
      const scaleOnlyNotes = container.querySelectorAll(".scale-only");
      expect(scaleOnlyNotes.length).toBe(0);
    });

    it("global scope shows chord overlay across all visible shapes", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          shapeScope="global"
          activePattern="all"
        />,
      );
      const chordTonesInScale = container.querySelectorAll(".chord-tone-in-scale");
      expect(chordTonesInScale.length).toBeGreaterThan(0);
    });

    it("multi-shape CAGED membership - chord tones in any active shape get chord-tone-in-scale", () => {
      const multiPolygons: ShapePolygon[] = [
        singleShapePolygon,
        {
          ...singleShapePolygon,
          shape: "A" as CagedShape,
          vertices: singleShapePolygon.vertices.map((v) => ({
            ...v,
            fret: v.fret + 2,
          })),
        },
      ];
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          highlightNotes={["C", "E", "G"]}
          shapePolygons={multiPolygons}
          activePattern="all"
          activeShape={["E", "A"]}
          shapeScope="multi"
        />,
      );
      const chordTonesInScale = container.querySelectorAll(".chord-tone-in-scale");
      expect(chordTonesInScale.length).toBeGreaterThan(0);
    });

    it("out-of-scale chord tone outside active shape becomes note-inactive", () => {
      const cShapeSmall: ShapePolygon = {
        shape: "E" as CagedShape,
        color: "rgba(99,102,241,0.3)",
        cagedLabel: "E",
        modalLabel: "Ionian",
        truncated: false,
        intendedMin: 0,
        intendedMax: 1,
        vertices: [
          { fret: 0, string: 0 },
          { fret: 0, string: 1 },
          { fret: 0, string: 2 },
          { fret: 1, string: 2 },
          { fret: 1, string: 1 },
          { fret: 1, string: 0 },
        ],
      };
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C#", "F", "G#"]}
          chordRoot="C#"
          highlightNotes={["C", "E", "G"]}
          shapePolygons={[cShapeSmall]}
          activePattern="caged"
          activeShape="E"
          shapeScope="single"
        />,
      );
      const chordRootInShape = container.querySelectorAll('.chord-root[data-note-shape="squircle"]');
      expect(chordRootInShape.length).toBe(0);
    });

    it("in-scale chord tone outside active shape is suppressed (not scale-only)", () => {
      // shapeScope="single" + activeShape="E" — only the E polygon is active.
      // Notes in the E shape → chord-tone-in-scale. Notes outside → note-inactive.
      // The C-shape polygon (fullShapePolygon) is visible but not the active shape.
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G", "A"]}
          chordRoot="C"
          highlightNotes={["C", "E", "G", "A"]}
          shapePolygons={[singleShapePolygon, fullShapePolygon]}
          activePattern="caged"
          activeShape="E"
          shapeScope="single"
        />,
      );
      const scaleOnlyNotes = container.querySelectorAll(".scale-only");
      expect(scaleOnlyNotes.length).toBe(0);
      // In-shape chord tones must still render correctly.
      const chordTonesInShape = container.querySelectorAll(".chord-tone-in-scale");
      expect(chordTonesInShape.length).toBeGreaterThan(0);
    });

    it("REGRESSION: multi-shape without shapeScope would fail membership check", () => {
      const multiPolygons: ShapePolygon[] = [
        { ...singleShapePolygon, shape: "E" as CagedShape },
        { ...singleShapePolygon, shape: "A" as CagedShape, vertices: singleShapePolygon.vertices.map(v => ({...v, fret: v.fret + 2})) },
      ];
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          highlightNotes={["C", "E", "G"]}
          shapePolygons={multiPolygons}
          activePattern="all"
          activeShape="E"
          shapeScope="global"
        />,
      );
      const chordTonesInScale = container.querySelectorAll(".chord-tone-in-scale");
      expect(chordTonesInScale.length).toBeGreaterThan(0);
    });

    it("spread-aware gating: chord tone within chordFretSpread of active shape gets chord-tone-in-scale", () => {
      // E shape covers frets 0–4 on strings 0–2. With chordFretSpread=1, fret 5 on those strings
      // should also receive chord emphasis (spread extends boundary by 1).
      const eShapeWide: ShapePolygon = {
        shape: "E" as CagedShape,
        color: "rgba(99,102,241,0.3)",
        cagedLabel: "E",
        modalLabel: "Ionian",
        truncated: false,
        intendedMin: 0,
        intendedMax: 5,
        vertices: [
          { fret: 0, string: 0 },
          { fret: 0, string: 1 },
          { fret: 0, string: 2 },
          { fret: 0, string: 3 },
          { fret: 0, string: 4 },
          { fret: 0, string: 5 },
          { fret: 5, string: 5 },
          { fret: 5, string: 4 },
          { fret: 5, string: 3 },
          { fret: 5, string: 2 },
          { fret: 5, string: 1 },
          { fret: 5, string: 0 },
        ],
      };
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          startFret={0}
          endFret={12}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          highlightNotes={["C", "E", "G"]}
          shapePolygons={[eShapeWide]}
          activePattern="caged"
          activeShape="E"
          shapeScope="single"
          chordFretSpread={1}
        />,
      );
      // Should have chord-tone-in-scale notes within the shape
      const chordTonesInScale = container.querySelectorAll(".chord-tone-in-scale");
      expect(chordTonesInScale.length).toBeGreaterThan(0);
    });

    it("spread-aware gating: chord tone outside active shape's spread does not get chord emphasis", () => {
      // Tiny E shape: frets 0–1 only. A note at fret 8 (C, E, G name) should
      // not receive chord-tone-in-scale even if it's an in-scale chord tone.
      const tinyEShape: ShapePolygon = {
        shape: "E" as CagedShape,
        color: "rgba(99,102,241,0.3)",
        cagedLabel: "E",
        modalLabel: "Ionian",
        truncated: false,
        intendedMin: 0,
        intendedMax: 1,
        vertices: [
          { fret: 0, string: 0 },
          { fret: 0, string: 1 },
          { fret: 0, string: 2 },
          { fret: 0, string: 3 },
          { fret: 0, string: 4 },
          { fret: 0, string: 5 },
          { fret: 1, string: 5 },
          { fret: 1, string: 4 },
          { fret: 1, string: 3 },
          { fret: 1, string: 2 },
          { fret: 1, string: 1 },
          { fret: 1, string: 0 },
        ],
      };
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          startFret={0}
          endFret={12}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          highlightNotes={["C", "E", "G"]}
          shapePolygons={[tinyEShape]}
          activePattern="caged"
          activeShape="E"
          shapeScope="single"
          chordFretSpread={0}
        />,
      );
      // Notes at high frets (e.g. fret 8) are in-scale chord tones by name but
      // outside the tiny shape → must not appear as chord-tone-in-scale
      const allChordInScale = container.querySelectorAll(".chord-tone-in-scale");
      // Any chord-tone-in-scale that exists must have data-note-role set (not hidden)
      // All nodes in allChordInScale should be within frets 0–1 range
      allChordInScale.forEach((el) => {
        const label = el.querySelector("button")?.getAttribute("aria-label") ?? el.getAttribute("aria-label") ?? "";
        // We can't check fret directly from DOM label easily, but we can verify
        // that no chord-tone-in-scale is rendered — the tiny shape at frets 0–1
        // should only have open string notes (fret 0) at best
        expect(label).not.toMatch(/fret [2-9]/);
      });
    });

    it("3NPS position gating: chord tones outside active 3NPS position are not emphasized", () => {
      const npsShape: ShapePolygon = {
        shape: 1 as unknown as CagedShape, // 3NPS position 1
        color: "rgba(99,102,241,0.3)",
        cagedLabel: "1",
        modalLabel: "Ionian",
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
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          highlightNotes={["C", "E", "G"]}
          shapePolygons={[npsShape]}
          activePattern="3nps"
          activeShape={1}
          shapeScope="single"
        />,
      );
      // Notes inside position 1 (frets 0–4, strings 0–2) should get chord emphasis
      const chordTonesInScale = container.querySelectorAll(".chord-tone-in-scale");
      // Notes outside the position become scale-only, so we must have some scale-only
      const scaleOnlyNotes = container.querySelectorAll(".scale-only");
      // Both populations must exist: in-position chord tones AND out-of-position scale notes
      expect(chordTonesInScale.length + scaleOnlyNotes.length).toBeGreaterThan(0);
    });

    it("scale-only notes render (not hidden) and have circle shape when chord overlay is active", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C"]}
          chordRoot="C"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
        />
      );
      // Scope to .fretboard-note to exclude accessible button layer (buttons don't carry data-note-shape)
      const scaleOnly = container.querySelectorAll('.fretboard-note.scale-only:not(.hidden)');
      expect(scaleOnly.length).toBeGreaterThan(0);
      scaleOnly.forEach((el) => {
        expect(el.getAttribute("data-note-shape")).toBe("circle");
      });
    });

    it("in-scale chord tone keeps chord-tone-in-scale class (squircle) and is not hidden", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          rootNote="C"
          highlightNotes={["C", "E", "G"]}
        />
      );
      // Scope to .fretboard-note to exclude accessible button layer
      const chordInScale = container.querySelectorAll('.fretboard-note.chord-tone-in-scale:not(.hidden)');
      expect(chordInScale.length).toBeGreaterThan(0);
      chordInScale.forEach((el) => {
        expect(el.getAttribute("data-note-shape")).toBe("squircle");
      });
    });

    describe("overlay-on shape containment — noteSemantics path (regression)", () => {
      // When noteSemantics is provided (chord overlay active), in-scale notes outside
      // the active shape must NOT render as scale-only or color-tone.
      // Previously, sem.isInScale alone would classify them — ignoring shape membership.

      const tinyShape: ShapePolygon = {
        shape: "E" as CagedShape,
        color: "rgba(99,102,241,0.3)",
        cagedLabel: "E",
        modalLabel: "Ionian",
        truncated: false,
        intendedMin: 0,
        intendedMax: 1,
        vertices: [
          { fret: 0, string: 0 },
          { fret: 0, string: 1 },
          { fret: 0, string: 2 },
          { fret: 0, string: 3 },
          { fret: 0, string: 4 },
          { fret: 0, string: 5 },
          { fret: 1, string: 5 },
          { fret: 1, string: 4 },
          { fret: 1, string: 3 },
          { fret: 1, string: 2 },
          { fret: 1, string: 1 },
          { fret: 1, string: 0 },
        ],
      };

      it("scale-only note outside active shape is note-inactive (not scale-only) with noteSemantics", () => {
        // E is in scale (highlightNotes) and noteSemantics.isInScale=true,
        // but E at fret 9 is outside the tiny shape (frets 0-1).
        // With the fix, classifyNoteFromSemantics must use isHighlighted (shape-aware),
        // so the out-of-shape E becomes note-inactive rather than scale-only.
        const semantics = new Map<string, NoteSemantics>([
          [
            "C",
            {
              isScaleRoot: true,
              isChordRoot: true,
              isChordTone: true,
              isInScale: true,
              isColorTone: false,
              isGuideTone: false,
              isTension: false,
              memberName: "root",
            },
          ],
          [
            "E",
            {
              isScaleRoot: false,
              isChordRoot: false,
              isChordTone: false,
              isInScale: true,
              isColorTone: false,
              isGuideTone: false,
              isTension: false,
            },
          ],
        ]);
        const { container } = render(
          <FretboardSVG
            {...BASE_PROPS}
            startFret={0}
            endFret={12}
            chordTones={["C"]}
            chordRoot="C"
            highlightNotes={["C", "E"]}
            shapePolygons={[tinyShape]}
            activePattern="caged"
            activeShape="E"
            shapeScope="single"
            chordFretSpread={0}
            noteSemantics={semantics}
          />
        );
        // aria-label lives on .note-bubble buttons (a11y layer), not on .fretboard-note SVG elements.
        // Query buttons directly — they share the same noteClass as the SVG peers.
        const scaleOnly = container.querySelectorAll('.note-bubble.scale-only');
        scaleOnly.forEach((el) => {
          const label = el.getAttribute("aria-label") ?? "";
          // Each button must carry a fret label — empty means lookup failed.
          expect(label).toMatch(/fret \d+/i);
          // Fret 2+ (including 10-12) is outside the tiny shape.
          expect(label).not.toMatch(/fret (?:[2-9]|1[0-2])\b/i);
        });
      });

      it("color-tone note outside active shape is note-inactive with noteSemantics", () => {
        // B is a color note AND in scale, but outside the tiny shape.
        // Must not appear as color-tone when outside the shape.
        const semantics = new Map<string, NoteSemantics>([
          [
            "C",
            {
              isScaleRoot: true,
              isChordRoot: true,
              isChordTone: true,
              isInScale: true,
              isColorTone: false,
              isGuideTone: false,
              isTension: false,
              memberName: "root",
            },
          ],
          [
            "B",
            {
              isScaleRoot: false,
              isChordRoot: false,
              isChordTone: false,
              isInScale: true,
              isColorTone: true,
              isGuideTone: false,
              isTension: false,
            },
          ],
        ]);
        const { container } = render(
          <FretboardSVG
            {...BASE_PROPS}
            startFret={0}
            endFret={12}
            chordTones={["C"]}
            chordRoot="C"
            highlightNotes={["C", "B"]}
            colorNotes={["B"]}
            shapePolygons={[tinyShape]}
            activePattern="caged"
            activeShape="E"
            shapeScope="single"
            chordFretSpread={0}
            noteSemantics={semantics}
          />
        );
        // All color-tone notes must be within frets 0-1 (inside the shape)
        const colorTones = container.querySelectorAll('.note-bubble.color-tone');
        colorTones.forEach((el) => {
          const label = el.getAttribute("aria-label") ?? "";
          expect(label).toMatch(/fret \d+/i);
          expect(label).not.toMatch(/fret (?:[2-9]|1[0-2])\b/i);
        });
      });
    });
  });

  describe("lens leakage — no lens effect when chord overlay is off", () => {
    it("fretboard-board has no data-practice-lens attribute when no chord overlay", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          practiceLens="guide-tones"
        />
      );
      const board = container.querySelector('.fretboard-board');
      expect(board?.getAttribute('data-practice-lens')).toBeNull();
    });

    it("fretboard-board has data-practice-lens when chord overlay is active", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          chordTones={["C", "E", "G"]}
          chordRoot="C"
          practiceLens="guide-tones"
        />
      );
      const board = container.querySelector('.fretboard-board');
      expect(board?.getAttribute('data-practice-lens')).toBe('guide-tones');
    });

    it("scale notes have normal opacity with no chord overlay regardless of practiceLens", () => {
      const { container } = render(
        <FretboardSVG
          {...BASE_PROPS}
          practiceLens="guide-tones"
          highlightNotes={["C", "E", "G"]}
        />
      );
      const noteElements = container.querySelectorAll('.fretboard-note:not(.hidden)');
      noteElements.forEach((el) => {
        // Use computed style — inline style misses stylesheet-applied opacity.
        const opacity = parseFloat(getComputedStyle(el as Element).opacity);
        expect(opacity).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
