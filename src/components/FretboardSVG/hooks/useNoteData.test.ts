import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNoteData } from "./useNoteData";
import type { ShapePolygon, CagedShape } from "../../../shapes";

describe("useNoteData", () => {
  it("generates correct note data for a simple tuning", () => {
    const { result } = renderHook(() =>
      useNoteData({
        numStrings: 6,
        fretboardLayout: [
          ["E", "F", "F#"],
          ["A", "A#", "B"],
          ["D", "D#", "E"],
          ["G", "G#", "A"],
          ["B", "C", "C#"],
          ["E", "F", "F#"]
        ],
        totalColumns: 2,
        startFret: 0,
        maxFret: 22,
        hiddenNotes: new Set(),
        highlightNotes: ["E", "A"],
        hasChordOverlay: false,
        chordTones: [],
        rootNote: "E",
        colorNotes: [],
        shapePolygons: [],
        boxBounds: [],
        chordFretSpread: 0,
        scaleName: "minor-pentatonic",
        useFlats: false,
        wrappedNotes: new Set(),
        tuning: ["E4", "B3", "G3", "D3", "A2", "E2"]
      })
    );

    const data = result.current;
    expect(data.length).toBeGreaterThan(0);
    const e2Note = data.find(n => n.noteName === "E" && n.fretIndex === 0 && n.stringIndex === 0);
    expect(e2Note).toBeDefined();
    expect(e2Note?.noteClass).toBe("key-tonic");
  });

  describe("symmetric chord-spread contract", () => {
    // Single-string chromatic layout starting on E2 across frets 0-12.
    // E, F, F#, G, G#, A, A#, B, C, C#, D, D#, E
    const SINGLE_STRING_LAYOUT = [[
      "E", "F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E",
    ]];

    // CAGED-style polygon spanning frets 5-7 on a single string. Anchored well
    // clear of fret 0 so left-spread is observable (clampedLeft = 5; spread
    // values up to 4 still produce a positive lower bound). Vertex layout
    // matches buildPolygonFromNotes: leftEdge first, rightEdge reversed.
    const polyAt5To7: ShapePolygon = {
      shape: "E" as CagedShape,
      color: "rgba(0,0,0,0.1)",
      cagedLabel: "E",
      modalLabel: null,
      truncated: false,
      intendedMin: 5,
      intendedMax: 7,
      vertices: [
        { fret: 5, string: 0 },
        { fret: 7, string: 0 },
      ],
    };

    function buildSpreadHook(chordFretSpread: number) {
      return renderHook(() =>
        useNoteData({
          numStrings: 1,
          fretboardLayout: SINGLE_STRING_LAYOUT,
          totalColumns: 12,
          startFret: 0,
          maxFret: 12,
          hiddenNotes: new Set(),
          highlightNotes: ["C", "E", "G"],
          hasChordOverlay: true,
          chordTones: ["C", "E", "G"],
          rootNote: "C",
          chordRoot: "C",
          colorNotes: [],
          shapePolygons: [polyAt5To7],
          boxBounds: [],
          chordFretSpread,
          activePattern: "caged",
          shapeScope: "single",
          activeShape: "E" as CagedShape,
          scaleName: "Major",
          useFlats: false,
          wrappedNotes: new Set(),
          tuning: ["E2"],
        }),
      );
    }

    // Chord-emphasis classes — the visible "active region" classes that indicate
    // a chord tone is reached by the polygon + chordFretSpread window. The chord
    // root takes precedence over chord-tone-in-scale (see semantics.classifyNote
    // line 83), so fret 8 (C, the chord root) gets `chord-root` not
    // `chord-tone-in-scale` even though the spread is reaching it.
    const CHORD_EMPHASIS_CLASSES = new Set([
      "chord-root",
      "chord-tone-in-scale",
      "chord-tone-outside-scale",
      "note-diatonic-chord",
    ]);

    function isEmphasized(noteClass: string): boolean {
      return CHORD_EMPHASIS_CLASSES.has(noteClass);
    }

    function emphasizedFrets(notes: ReturnType<typeof useNoteData>): number[] {
      return notes
        .filter((n) => isEmphasized(n.noteClass))
        .map((n) => n.fretIndex)
        .sort((a, b) => a - b);
    }

    it("chordFretSpread=0 emphasizes no chord tones outside the polygon (5-7)", () => {
      const { result } = buildSpreadHook(0);
      const emphasized = emphasizedFrets(result.current);
      // The single-string layout has chord tones at frets 0(E), 3(G), 8(C), 12(E).
      // Polygon spans frets 5-7; with spread=0, none of those chord-tone frets
      // fall within [5,7] (5=A, 6=A#, 7=B). All chord tones must be note-inactive.
      expect(emphasized).toEqual([]);
    });

    it("chordFretSpread=1 reaches one fret outward both sides — neither chord tone yet", () => {
      const { result } = buildSpreadHook(1);
      const emphasized = emphasizedFrets(result.current);
      // Spread=1 → active window [4, 8]. Layout chord tones in that window:
      // fret 4 (G#) — not a chord tone; fret 8 (C) — chord root in window.
      // fret 3 (G) is just outside the left edge of the spread window.
      expect(emphasized).toContain(8); // C, chord root, in active window
      expect(emphasized).not.toContain(3); // G, just outside left edge
      expect(emphasized).not.toContain(0); // E at open string, far outside
      expect(emphasized).not.toContain(12); // E far outside right edge
    });

    it("chordFretSpread=2 reaches both directions — fret 3 (left) and fret 8 (right) emphasized", () => {
      const { result } = buildSpreadHook(2);
      const emphasized = emphasizedFrets(result.current);
      // Spread=2 → active window [3, 9]. Both fret 3 (G, chord tone in scale)
      // and fret 8 (C, chord root) sit inside the window.
      expect(emphasized).toContain(3); // left-spread reach: G
      expect(emphasized).toContain(8); // within polygon + spread: C chord root
      expect(emphasized).not.toContain(0); // E at open string, beyond left edge
      expect(emphasized).not.toContain(12); // E beyond right edge
    });

    it("chordFretSpread spread is symmetric — left reach equals right reach for an interior polygon", () => {
      // For polygon at frets 5-7 with spread=4, the active window is [1, 11].
      // The chromatic single-string layout provides exactly one chord tone in
      // each direction within reach: fret 3 (G) on the left, fret 8 (C) on the
      // right. Symmetric spread → equal counts on both sides.
      const { result } = buildSpreadHook(4);
      const emphasized = emphasizedFrets(result.current);
      const leftEmphasized = emphasized.filter((f) => f < 5);
      const rightEmphasized = emphasized.filter((f) => f > 7);
      expect(leftEmphasized).toEqual([3]);
      expect(rightEmphasized).toEqual([8]);
      expect(leftEmphasized.length).toBe(rightEmphasized.length);
    });

    it("chordFretSpread is exact — left edge and right edge are inclusive", () => {
      // Spread=N means the active window is exactly [polygonMin - N, polygonMax + N].
      // For polygon 5-7, spread=2 gives [3, 9] inclusive. Verify the BOUNDARIES:
      // fret 3 (G, chord tone) IS emphasized; fret 8 (C, chord root) IS emphasized.
      // Spread=1 should EXCLUDE fret 3 (5-1=4 > 3) but INCLUDE fret 8 (7+1=8).
      const { result: r1 } = buildSpreadHook(1);
      const { result: r2 } = buildSpreadHook(2);
      const e1 = emphasizedFrets(r1.current);
      const e2 = emphasizedFrets(r2.current);
      // At spread=1: fret 3 NOT included (one fret beyond left bound), fret 8 included.
      expect(e1).not.toContain(3);
      expect(e1).toContain(8);
      // At spread=2: fret 3 included (exactly at left bound), fret 8 still included.
      expect(e2).toContain(3);
      expect(e2).toContain(8);
    });
  });

  it("assigns the blue-note color to blues-scale color notes", () => {
    const { result } = renderHook(() =>
      useNoteData({
        numStrings: 1,
        fretboardLayout: [["C", "C#", "D", "D#", "E", "F", "F#"]],
        totalColumns: 6,
        startFret: 0,
        maxFret: 22,
        hiddenNotes: new Set(),
        highlightNotes: ["C", "D#", "F", "F#", "G", "A#"],
        hasChordOverlay: false,
        chordTones: [],
        rootNote: "C",
        colorNotes: ["F#"],
        shapePolygons: [],
        boxBounds: [],
        chordFretSpread: 0,
        scaleName: "Minor Blues",
        useFlats: false,
        degreeColorsEnabled: true,
        wrappedNotes: new Set(),
        tuning: ["E2"]
      })
    );

    const blueNote = result.current.find((n) => n.noteName === "F#");
    expect(blueNote?.scaleDegree).toBe("b5");
    expect(blueNote?.degreeColor).toBe("#0047ff");
  });

});
