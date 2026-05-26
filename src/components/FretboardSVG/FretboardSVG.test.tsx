import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import "../../styles/index.css";
import "../../styles/themes.css";
import { FretboardSVG } from "../FretboardSVG/FretboardSVG";
import { getFretboardNotes } from "@fretflow/core";
import type { CagedShape, ShapePolygon } from "@fretflow/core";
import type { NoteSemantics } from "@fretflow/core";
import { axe } from "../../test-utils/a11y";
import { resolveFretboardMotionPolicy } from "./motionPolicy";

vi.mock("./motionPolicy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./motionPolicy")>();
  return { ...actual, resolveFretboardMotionPolicy: vi.fn().mockImplementation(actual.resolveFretboardMotionPolicy) };
});

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

const C_MAJOR = { chordTones: ["C", "E", "G"], chordRoot: "C", rootNote: "C", highlightNotes: ["C", "E", "G"] };
const renderCMajor = (extra: Record<string, unknown> = {}) =>
  render(<FretboardSVG {...BASE_PROPS} {...C_MAJOR} {...extra} />);

const sem = (entries: Array<[string, Partial<NoteSemantics>]>): Map<string, NoteSemantics> =>
  new Map(entries.map(([name, p]) => [name, {
    isScaleRoot: false, isChordRoot: false, isChordTone: false, isInScale: false,
    isColorTone: false, isGuideTone: false, isTension: false, ...p,
  }]));

const polyRect = (
  shape: CagedShape,
  minFret: number,
  maxFret: number,
  maxString = 2,
): ShapePolygon => {
  const vertices = [];
  for (let s = 0; s <= maxString; s++) vertices.push({ fret: minFret, string: s });
  for (let s = maxString; s >= 0; s--) vertices.push({ fret: maxFret, string: s });
  return {
    shape, color: "rgba(99,102,241,0.3)", cagedLabel: String(shape),
    modalLabel: "Ionian", truncated: false, intendedMin: minFret, intendedMax: maxFret, vertices,
  };
};

const E_SHAPE_C_MAJOR_VOICING = {
  shape: "E" as CagedShape,
  voicingKey: "e-shape-c-major",
  notes: [
    { stringIndex: 0, fretIndex: 8, noteName: "C" },
    { stringIndex: 1, fretIndex: 8, noteName: "G" },
    { stringIndex: 2, fretIndex: 9, noteName: "E" },
    { stringIndex: 3, fretIndex: 10, noteName: "C" },
    { stringIndex: 4, fretIndex: 10, noteName: "G" },
    { stringIndex: 5, fretIndex: 8, noteName: "C" },
  ],
};

describe("FretboardSVG/FretboardSVG", () => {
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

  it("classifies chord root and non-root chord tones distinctly", () => {
    const { container } = renderCMajor();
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
    const { container } = renderCMajor({ chordTones: ["C", "E", "G", "A#"] });
    expect(container.querySelectorAll(".chord-tone-outside-scale").length).toBeGreaterThan(0);
  });

  it("lead lens keeps in-scale chord root and outside chord tones visible", () => {
    const { container } = renderCMajor({ chordTones: ["C", "A#"], practiceLens: "lead" });
    expect(container.querySelectorAll(".chord-root.hidden").length).toBe(0);
    expect(container.querySelectorAll(".chord-tone-outside-scale:not(.hidden)").length).toBeGreaterThan(0);
  });

  it("outside chord root is visible and not hidden in lead lens", () => {
    const { container } = renderCMajor({
      chordTones: ["D", "F#", "A"], chordRoot: "D", practiceLens: "lead",
    });
    expect(container.querySelectorAll(".chord-root:not(.hidden)").length).toBeGreaterThan(0);
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

  it("renders chord roles only for matched full-chord coordinates and drives one explicit connector", () => {
    const semantics = sem([
      ["C", { isScaleRoot: true, isChordRoot: true, isChordTone: true, isInScale: true, memberName: "root", isFullChordMode: true }],
      ["E", { isChordTone: true, isInScale: true, memberName: "3", isFullChordMode: true }],
      ["G", { isChordTone: true, isInScale: true, memberName: "5", isFullChordMode: true }],
    ]);
    const fullChordPositionKeys = new Set(["0-8", "1-8", "2-9", "3-10", "4-10", "5-8"]);

    const { container } = renderCMajor({
      noteSemantics: semantics,
      fullChordPositionKeys,
      fullChordVoicings: [E_SHAPE_C_MAJOR_VOICING],
    });

    const chordRoleLabels = Array.from(
      container.querySelectorAll(
        ".note-bubble.chord-root:not(.hidden), .note-bubble.chord-tone-in-scale:not(.hidden)",
      ),
    )
      .map((el) => el.getAttribute("aria-label"))
      .sort();

    expect(chordRoleLabels).toEqual([
      "C on string 1, fret 8",
      "C on string 4, fret 10",
      "C on string 6, fret 8",
      "E on string 3, fret 9",
      "G on string 2, fret 8",
      "G on string 5, fret 10",
    ]);
    expect(container.querySelectorAll('path[data-layer="halo"]').length).toBe(1);
    expect(container.querySelectorAll('path[data-layer="fill"]').length).toBe(1);
    expect(container.querySelectorAll('path[data-layer="outline"]').length).toBe(1);
    expect(container.querySelector('.chord-root[data-full-chord-shape="E"]')).not.toBeNull();
    expect(container.querySelector('path[data-layer="fill"][data-caged-shape="E"]')).not.toBeNull();
    const rootPath = container.querySelector('.chord-root[data-full-chord-shape="E"] path:last-of-type');
    expect(rootPath).toHaveStyle({ fill: "var(--caged-e)" });
    expect(rootPath).toHaveStyle({ stroke: "var(--note-ring-tonic)" });
    expect(
      container.querySelector('.chord-root[data-full-chord-shape="E"] text'),
    ).toHaveStyle({ fill: "#ffffff" });
  });

  it("hides chord connectors when showChordConnectors is false", () => {
    const { container } = renderCMajor({
      fullChordVoicings: [E_SHAPE_C_MAJOR_VOICING],
      showChordConnectors: false,
    });
    expect(container.querySelector(".chord-connectors")).toBeNull();
  });

  it("replaces the full-chord connector group when full chords are toggled off", () => {
    const { container, rerender } = render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "E", "G"]}
        chordRoot="C"
        fullChordPositionKeys={new Set(["0-8", "1-8", "2-9", "3-10", "4-10", "5-8"])}
        fullChordVoicings={[E_SHAPE_C_MAJOR_VOICING]}
      />,
    );

    expect(container.querySelectorAll('path[data-caged-shape="E"]').length).toBeGreaterThan(0);
    expect(container.querySelector(".chord-connectors")).toHaveAttribute(
      "data-connector-source",
      "full-chord",
    );

    rerender(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "E", "G"]}
        chordRoot="C"
        fullChordPositionKeys={new Set()}
        fullChordVoicings={[]}
      />,
    );

    expect(container.querySelectorAll("path[data-caged-shape]").length).toBe(0);
    // When the voicing engine is the active source (chordTones non-empty) but
    // fullChordVoicings is empty, the connector layer is suppressed entirely —
    // no generated scatter is shown. The chord-connectors group is absent.
    expect(container.querySelector(".chord-connectors")).toBeNull();
  });

  it("keeps the D-shape light-theme background in the same gray family as dark mode", () => {
    const themedScope = document.createElement("div");
    themedScope.setAttribute("data-theme", "modern-light");
    document.body.appendChild(themedScope);

    expect(
      getComputedStyle(themedScope)
        .getPropertyValue("--caged-d-bg")
        .replace(/\s+/g, "")
        .trim(),
    ).toBe("rgba(153,153,153,0.35)");

    themedScope.remove();
  });

  describe("role-based shapes", () => {
    const SCALE_CEG = { rootNote: "C", highlightNotes: ["C", "E", "G"] };
    const DORIAN = {
      rootNote: "D",
      highlightNotes: ["D", "E", "F", "G", "A", "B", "C"],
      colorNotes: ["B"],
    };

    it.each<{ role: string; shape: string; props: Record<string, unknown> }>([
      {
        role: "chord-root",
        shape: "squircle",
        props: { ...SCALE_CEG, chordTones: ["C", "E", "G"], chordRoot: "C" },
      },
      {
        role: "chord-tone-in-scale",
        shape: "squircle",
        props: { ...SCALE_CEG, chordTones: ["C", "E", "G"], chordRoot: "C" },
      },
      {
        role: "chord-tone-outside-scale",
        shape: "diamond",
        props: { ...SCALE_CEG, chordTones: ["C", "E", "G", "A#"], chordRoot: "C" },
      },
      {
        role: "scale-only",
        shape: "circle",
        props: { ...SCALE_CEG, chordTones: ["C"], chordRoot: "C" },
      },
      {
        role: "note-active",
        shape: "circle",
        props: { ...SCALE_CEG },
      },
      {
        role: "color-tone",
        shape: "hexagon",
        props: { ...DORIAN, chordTones: ["D", "F", "A"], chordRoot: "D" },
      },
      {
        role: "note-blue",
        shape: "hexagon",
        props: { ...DORIAN },
      },
    ])("$role notes have data-note-shape=$shape", ({ role, shape, props }) => {
      const { container } = render(<FretboardSVG {...BASE_PROPS} {...props} />);
      expect(container.querySelectorAll(`.${role}[data-note-shape="${shape}"]`).length).toBeGreaterThan(0);
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

  describe("scale visibility 'off' mode — empty highlightNotes", () => {
    it("with chord overlay: chord root shown, in-scale tones become outside-scale, no scale-only", () => {
      const { container } = renderCMajor({ highlightNotes: [] });
      expect(container.querySelectorAll(".chord-root").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(".chord-tone-outside-scale").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(".scale-only").length).toBe(0);
      expect(container.querySelectorAll(".note-active").length).toBe(0);
    });

    it("without chord overlay: no note-active or key-tonic rendered", () => {
      const { container } = render(<FretboardSVG {...BASE_PROPS} highlightNotes={[]} />);
      expect(container.querySelectorAll(".note-active").length).toBe(0);
      expect(container.querySelectorAll(".key-tonic").length).toBe(0);
    });
  });

  describe("composable renderer contract — noteSemantics", () => {
    it("outside chord root gets data-note-tension and chord-root visual role", () => {
      const semantics = sem([
        ["C#", { isChordRoot: true, isChordTone: true, isTension: true, memberName: "root" }],
      ]);
      const { container } = renderCMajor({
        chordTones: ["C#", "F", "G#"], chordRoot: "C#", noteSemantics: semantics,
      });
      expect(container.querySelectorAll(".chord-root").length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.chord-root[data-note-tension="true"]').length).toBeGreaterThan(0);
    });

    it("in-scale chord root does NOT get data-note-tension", () => {
      const semantics = sem([
        ["C", { isScaleRoot: true, isChordRoot: true, isChordTone: true, isInScale: true, memberName: "root" }],
      ]);
      const { container } = renderCMajor({ noteSemantics: semantics });
      expect(container.querySelectorAll('.chord-root[data-note-tension="true"]').length).toBe(0);
    });

    it("guide tone gets data-note-guide-tone attribute", () => {
      const semantics = sem([
        ["B", { isChordTone: true, isInScale: true, isGuideTone: true, memberName: "3" }],
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
      expect(container.querySelectorAll('[data-note-guide-tone="true"]').length).toBeGreaterThan(0);
    });

    it("notes without semantics entry have no data-note-tension or data-note-guide-tone", () => {
      const semantics = sem([
        ["C", { isScaleRoot: true, isChordRoot: true, isChordTone: true, isInScale: true, memberName: "root" }],
      ]);
      const { container } = renderCMajor({ noteSemantics: semantics });
      expect(container.querySelectorAll('[data-note-tension="true"]').length).toBe(0);
      expect(container.querySelectorAll('[data-note-guide-tone="true"]').length).toBe(0);
    });

    it("without noteSemantics prop no data-note-tension attributes are emitted", () => {
      const { container } = renderCMajor({ chordTones: ["C#", "F", "G#"], chordRoot: "C#" });
      expect(container.querySelectorAll('[data-note-tension="true"]').length).toBe(0);
    });
  });

  describe("shape scope and membership", () => {
    const singleShapePolygon = polyRect("E" as CagedShape, 0, 4);
    const fullShapePolygon = polyRect("C" as CagedShape, 3, 5, 5);
    const tinyEShape = polyRect("E" as CagedShape, 0, 1, 5);

    it("single CAGED shape membership - chord tone inside shape is chord-tone-in-scale", () => {
      const { container } = renderCMajor({
        shapePolygons: [singleShapePolygon], activePattern: "caged", activeShape: "E", shapeScope: "single",
      });
      expect(
        container.querySelectorAll('.chord-tone-in-scale:not([data-note-role="chord-root"])').length,
      ).toBeGreaterThan(0);
    });

    it("single CAGED shape membership - chord tone outside shape is suppressed (not scale-only)", () => {
      // activeShape="C" but polygon is shape "E" — no polygon matches active shape,
      // so isInActiveShape=false everywhere. All notes should be note-inactive.
      const { container } = renderCMajor({
        shapePolygons: [singleShapePolygon], activePattern: "caged", activeShape: "C", shapeScope: "single",
      });
      expect(container.querySelectorAll(".scale-only").length).toBe(0);
    });

    it("global scope shows chord overlay across all visible shapes", () => {
      const { container } = renderCMajor({ shapeScope: "global", activePattern: "none" });
      expect(container.querySelectorAll(".chord-tone-in-scale").length).toBeGreaterThan(0);
    });

    it("multi-shape CAGED membership - chord tones in any active shape get chord-tone-in-scale", () => {
      const aShape = { ...singleShapePolygon, shape: "A" as CagedShape, vertices: singleShapePolygon.vertices.map(v => ({ ...v, fret: v.fret + 2 })) };
      const { container } = renderCMajor({
        shapePolygons: [singleShapePolygon, aShape],
        activePattern: "none", activeShape: ["E", "A"], shapeScope: "multi",
      });
      expect(container.querySelectorAll(".chord-tone-in-scale").length).toBeGreaterThan(0);
    });

    it("out-of-scale chord tone outside active shape becomes note-inactive", () => {
      const cShapeSmall = polyRect("E" as CagedShape, 0, 1);
      const { container } = renderCMajor({
        chordTones: ["C#", "F", "G#"], chordRoot: "C#",
        shapePolygons: [cShapeSmall], activePattern: "caged", activeShape: "E", shapeScope: "single", chordBoxBounds: [],
      });
      expect(container.querySelectorAll('.chord-root[data-note-shape="squircle"]').length).toBe(0);
    });

    it("in-scale chord tone outside active shape is suppressed (not scale-only)", () => {
      const { container } = renderCMajor({
        chordTones: ["C", "E", "G", "A"], highlightNotes: ["C", "E", "G", "A"],
        shapePolygons: [singleShapePolygon, fullShapePolygon],
        activePattern: "caged", activeShape: "E", shapeScope: "single",
      });
      expect(container.querySelectorAll(".scale-only").length).toBe(0);
      expect(container.querySelectorAll(".chord-tone-in-scale").length).toBeGreaterThan(0);
    });

    it("REGRESSION: multi-shape without shapeScope would fail membership check", () => {
      const aShape = { ...singleShapePolygon, shape: "A" as CagedShape, vertices: singleShapePolygon.vertices.map(v => ({ ...v, fret: v.fret + 2 })) };
      const { container } = renderCMajor({
        shapePolygons: [singleShapePolygon, aShape],
        activePattern: "none", activeShape: "E", shapeScope: "global",
      });
      expect(container.querySelectorAll(".chord-tone-in-scale").length).toBeGreaterThan(0);
    });

    it("spread-aware gating: chord tone within chordFretSpread of active shape gets chord-tone-in-scale", () => {
      const eShapeWide = polyRect("E" as CagedShape, 0, 5, 5);
      const { container } = renderCMajor({
        shapePolygons: [eShapeWide],
        activePattern: "caged", activeShape: "E", shapeScope: "single", chordFretSpread: 1,
      });
      expect(container.querySelectorAll(".chord-tone-in-scale").length).toBeGreaterThan(0);
    });

    it("spread-aware gating: chord tone outside active shape's spread does not get chord emphasis", () => {
      const { container } = renderCMajor({
        shapePolygons: [tinyEShape], activePattern: "caged", activeShape: "E", shapeScope: "single",
        chordFretSpread: 0, chordBoxBounds: [],
      });
      container.querySelectorAll(".chord-tone-in-scale").forEach((el) => {
        const label = el.querySelector("button")?.getAttribute("aria-label") ?? el.getAttribute("aria-label") ?? "";
        expect(label).not.toMatch(/fret [2-9]/);
      });
    });

    it("3NPS position gating: chord tones outside active 3NPS position are not emphasized", () => {
      const npsShape = { ...polyRect(1 as unknown as CagedShape, 0, 4), cagedLabel: "1" };
      const { container } = renderCMajor({
        shapePolygons: [npsShape], activePattern: "3nps", activeShape: 1, shapeScope: "single",
      });
      const total =
        container.querySelectorAll(".chord-tone-in-scale").length +
        container.querySelectorAll(".scale-only").length;
      expect(total).toBeGreaterThan(0);
    });

    it.each<[string, string, Record<string, unknown>]>([
      ["scale-only", "circle", { chordTones: ["C"] }],
      ["chord-tone-in-scale", "squircle", {}],
    ])("%s notes render (not hidden) with data-note-shape=%s under chord overlay", (cls, shape, extra) => {
      const { container } = renderCMajor(extra);
      const notes = container.querySelectorAll(`.fretboard-note.${cls}:not(.hidden)`);
      expect(notes.length).toBeGreaterThan(0);
      notes.forEach((el) => expect(el.getAttribute("data-note-shape")).toBe(shape));
    });

    describe("overlay-on shape containment — noteSemantics path (regression)", () => {
      // When noteSemantics is provided (chord overlay active), in-scale notes outside
      // the active shape must NOT render as scale-only or color-tone.
      const cRoot: [string, Partial<NoteSemantics>] = [
        "C", { isScaleRoot: true, isChordRoot: true, isChordTone: true, isInScale: true, memberName: "root" },
      ];
      const inShape = (selector: string, container: HTMLElement) => {
        container.querySelectorAll(selector).forEach((el) => {
          const label = el.getAttribute("aria-label") ?? "";
          expect(label).toMatch(/fret \d+/i);
          expect(label).not.toMatch(/fret (?:[2-9]|1[0-2])\b/i);
        });
      };

      it.each<[string, string, string[], Array<[string, Partial<NoteSemantics>]>, Record<string, unknown>]>([
        [
          "scale-only", ".note-bubble.scale-only",
          ["C", "E"],
          [cRoot, ["E", { isInScale: true }]],
          {},
        ],
        [
          "color-tone", ".note-bubble.color-tone",
          ["C", "B"],
          [cRoot, ["B", { isInScale: true, isColorTone: true }]],
          { colorNotes: ["B"] },
        ],
      ])("%s note outside active shape is note-inactive with noteSemantics", (_label, selector, highlightNotes, entries, extra) => {
        const { container } = render(
          <FretboardSVG
            {...BASE_PROPS}
            chordTones={["C"]}
            chordRoot="C"
            highlightNotes={highlightNotes}
            shapePolygons={[tinyEShape]}
            activePattern="caged"
            activeShape="E"
            shapeScope="single"
            chordFretSpread={0}
            chordBoxBounds={[]}
            noteSemantics={sem(entries)}
            {...extra}
          />
        );
        inShape(selector, container as HTMLElement);
      });
    });
  });

  describe("lens leakage — no lens effect when chord overlay is off", () => {
    it("data-practice-lens only present when chord overlay is active", () => {
      const { container, rerender } = render(<FretboardSVG {...BASE_PROPS} practiceLens="tones" />);
      expect(container.querySelector('.fretboard-board')?.getAttribute('data-practice-lens')).toBeNull();
      rerender(<FretboardSVG {...BASE_PROPS} chordTones={["C", "E", "G"]} chordRoot="C" practiceLens="tones" />);
      expect(container.querySelector('.fretboard-board')?.getAttribute('data-practice-lens')).toBe('tones');
    });

    it("scale notes have normal opacity with no chord overlay regardless of practiceLens", () => {
      const { container } = render(<FretboardSVG {...BASE_PROPS} practiceLens="tones" />);
      container.querySelectorAll('.fretboard-note:not(.hidden)').forEach((el) => {
        expect(parseFloat(getComputedStyle(el as Element).opacity)).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("motion policy wiring", () => {
    const MINIMAL_POLYGON = polyRect("E" as CagedShape, 0, 4, 1);

    it("uses group-mode wrappers when policy returns group modes", () => {
      const { container } = renderCMajor({ shapePolygons: [MINIMAL_POLYGON] });
      expect(container.querySelectorAll('[data-motion="group"]').length).toBeGreaterThan(0);
      expect(container.querySelector('[data-motion="none"]')).toBeNull();
    });

    it("collapses to static wrappers (data-motion=none) when policy returns none modes", () => {
      vi.mocked(resolveFretboardMotionPolicy).mockReturnValueOnce({
        noteMode: "none", shapeMode: "none", connectorMode: "none",
      });
      const { container } = renderCMajor({ shapePolygons: [MINIMAL_POLYGON] });
      expect(container.querySelector('[data-motion="group"]')).toBeNull();
      expect(container.querySelectorAll('[data-motion="none"]').length).toBeGreaterThan(0);
    });
  });

  describe("note layer a11y contract", () => {
    const getSvgNotes = () =>
      Array.from(
        document.querySelectorAll<SVGGElement>('g[class*="fretboard-note"]'),
      );

    it("exposes each note as a button with a labelled role and aria-label", () => {
      render(<FretboardSVG {...BASE_PROPS} onNoteClick={() => {}} />);
      const notes = getSvgNotes();
      expect(notes.length).toBeGreaterThan(0);
      notes.forEach((g) => {
        expect(g.getAttribute("role")).toBe("button");
        const label = g.getAttribute("aria-label") || "";
        expect(label).toMatch(/^[A-G][#♯♭b]?\d\s—\s.+$/);
      });
    });

    it("aria-label includes the correct octave for open low/high E strings", () => {
      render(<FretboardSVG {...BASE_PROPS} highlightNotes={["E"]} onNoteClick={() => {}} />);
      const labels = getSvgNotes()
        .map((g) => g.getAttribute("aria-label") || "")
        .filter(Boolean);
      expect(labels.some((l) => l.startsWith("E2 — "))).toBe(true);
      expect(labels.some((l) => l.startsWith("E4 — "))).toBe(true);
    });

    it("toggles tabIndex based on onNoteClick presence", () => {
      const { rerender } = render(<FretboardSVG {...BASE_PROPS} onNoteClick={() => {}} />);
      expect(getSvgNotes().some((g) => g.getAttribute("tabindex") === "0")).toBe(true);
      rerender(<FretboardSVG {...BASE_PROPS} />);
      getSvgNotes().forEach((g) => {
        expect(g.getAttribute("tabindex")).toBe("-1");
      });
    });

    it.each([["Enter"], [" "]])("%s key invokes onNoteClick on focused note", (key) => {
      const onNoteClick = vi.fn();
      render(<FretboardSVG {...BASE_PROPS} onNoteClick={onNoteClick} />);
      fireEvent.keyDown(getSvgNotes()[0], { key });
      expect(onNoteClick).toHaveBeenCalledTimes(1);
    });

    it("ignores unrelated keys", () => {
      const onNoteClick = vi.fn();
      render(<FretboardSVG {...BASE_PROPS} onNoteClick={onNoteClick} />);
      const note = getSvgNotes()[0];
      fireEvent.keyDown(note, { key: "a" });
      fireEvent.keyDown(note, { key: "Tab" });
      expect(onNoteClick).not.toHaveBeenCalled();
    });
  });
});
