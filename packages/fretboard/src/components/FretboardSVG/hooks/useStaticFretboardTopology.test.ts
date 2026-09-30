import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ShapePolygon } from "@fretflow/core";
import { useStaticFretboardTopology } from "./useStaticFretboardTopology";

const TOPOLOGY_PROPS = {
  numStrings: 1,
  fretboardLayout: [["G", "G#", "A", "A#", "B"]],
  totalColumns: 4,
  startFret: 0,
  maxFret: 5,
  highlightNotes: ["G", "A", "B"],
  hasChordOverlay: true,
  chordTones: ["G", "B", "D"],
  rootNote: "G",
  chordRoot: "G",
  colorNotes: [],
  shapePolygons: [],
  chordBoxBounds: null,
  chordFretSpread: 0,
  scaleName: "major",
  preferFlats: false,
  displayFormat: "notes" as const,
  wrappedNotes: new Set<string>(),
  tuning: ["G3"],
};

describe("useStaticFretboardTopology", () => {
  it("keeps the topology reference stable when topology inputs do not change", () => {
    const { result, rerender } = renderHook((props) => useStaticFretboardTopology(props), {
      initialProps: TOPOLOGY_PROPS,
    });

    const initialTopology = result.current;

    rerender(TOPOLOGY_PROPS);

    expect(result.current).toBe(initialTopology);
  });

  it("marks notes covered by polygon ranges including truncated polygons' visible portion", () => {
    const shapePolygons: ShapePolygon[] = [
      {
        shape: "C",
        color: "red",
        cagedLabel: "C",
        modalLabel: null,
        truncated: false,
        intendedMin: 3,
        intendedMax: 5,
        vertices: [
          { string: 0, fret: 3 },
          { string: 1, fret: 4 },
          { string: 1, fret: 5 },
          { string: 0, fret: 5 },
        ],
      },
      {
        shape: "A",
        color: "blue",
        cagedLabel: "A",
        modalLabel: null,
        truncated: true,
        intendedMin: 0,
        intendedMax: 2,
        vertices: [
          { string: 0, fret: 0 },
          { string: 1, fret: 0 },
          { string: 1, fret: 2 },
          { string: 0, fret: 2 },
        ],
      },
    ];

    const { result } = renderHook(() => useStaticFretboardTopology({
      ...TOPOLOGY_PROPS,
      numStrings: 2,
      fretboardLayout: [
        ["G", "G#", "A", "A#", "B", "C"],
        ["D", "D#", "E", "F", "F#", "G"],
      ],
      totalColumns: 5,
      maxFret: 6,
      shapePolygons,
      tuning: ["G3", "D3"],
    }));

    expect(result.current.find((note) => note.positionKey === "0-3")?.isInsideAnyPolygon).toBe(true);
    // Truncated A-shape polygon (intended 0..2) on-board portion covers 0-1/0-2/1-0/1-1/1-2 now.
    expect(result.current.find((note) => note.positionKey === "0-1")?.isInsideAnyPolygon).toBe(true);
    expect(result.current.find((note) => note.positionKey === "1-4")?.isInsideAnyPolygon).toBe(true);
    // Outside both polygons:
    expect(result.current.find((note) => note.positionKey === "1-3")?.isInsideAnyPolygon).toBe(false);
  });

  it("applies dim opacity to note-active scale notes sitting outside CAGED shape polygons when chord overlay is off", () => {
    const shapePolygons: ShapePolygon[] = [
      {
        shape: "C",
        color: "red",
        cagedLabel: "C",
        modalLabel: null,
        truncated: false,
        intendedMin: 3,
        intendedMax: 5,
        vertices: [
          { string: 0, fret: 3 },
          { string: 0, fret: 5 },
        ],
      },
    ];

    const { result } = renderHook(() => useStaticFretboardTopology({
      ...TOPOLOGY_PROPS,
      numStrings: 1,
      fretboardLayout: [["G", "G#", "A", "A#", "B", "C"]],
      totalColumns: 5,
      maxFret: 6,
      shapePolygons,
      hasChordOverlay: false,
      tuning: ["G3"],
    }));

    // Inside polygon (fret 4 / position '0-4') -> applyDimOpacity should be false
    expect(result.current.find((note) => note.positionKey === "0-4")?.noteClass).toBe("note-active");
    expect(result.current.find((note) => note.positionKey === "0-4")?.applyDimOpacity).toBe(false);
    // Outside polygon (fret 2 / position '0-2') -> applyDimOpacity should be true for note-active
    expect(result.current.find((note) => note.positionKey === "0-2")?.noteClass).toBe("note-active");
    expect(result.current.find((note) => note.positionKey === "0-2")?.applyDimOpacity).toBe(true);
  });

  describe("3NPS: isInPatternFretWindow vs. isInActiveShape", () => {
    // 3NPS's coordinate whitelist (highlightNotes, in "string-fret" form) only
    // ever contains SCALE positions (get3NPSCoordinates walks scale notes
    // only) — an out-of-scale pitch can never have a coordinate there, even
    // when its fret sits inside the shape's box. isInPatternFretWindow is the
    // same fret-range test with that whitelist dropped.
    const THREE_NPS_PROPS = {
      ...TOPOLOGY_PROPS,
      fretboardLayout: [["G", "G#", "A", "A#", "B", "C"]],
      totalColumns: 5,
      maxFret: 6,
      activePattern: "3nps" as const,
      shapeScope: "single" as const,
      chordBoxBounds: [{ minFret: 0, maxFret: 3 }],
      // Deliberately omits "0-3" (B, fret 3) even though fret 3 is inside the
      // box — simulating an out-of-scale guide tone the 3NPS walker never
      // placed a coordinate for.
      highlightNotes: ["0-0", "0-2"],
    };

    it("excludes a whitelist-only position from isInActiveShape but admits it via isInPatternFretWindow", () => {
      const { result } = renderHook(() => useStaticFretboardTopology(THREE_NPS_PROPS));
      const note = result.current.find((n) => n.positionKey === "0-3");
      expect(note?.isInActiveShape).toBe(false);
      expect(note?.isInPatternFretWindow).toBe(true);
    });

    it("excludes a position outside the fret window from both", () => {
      const { result } = renderHook(() => useStaticFretboardTopology(THREE_NPS_PROPS));
      // Fret 5 is outside chordBoxBounds [0, 3] (chordFretSpread: 0).
      const note = result.current.find((n) => n.positionKey === "0-5");
      expect(note?.isInActiveShape).toBe(false);
      expect(note?.isInPatternFretWindow).toBe(false);
    });

    it("keeps an in-whitelist position true for both (no regression)", () => {
      const { result } = renderHook(() => useStaticFretboardTopology(THREE_NPS_PROPS));
      const note = result.current.find((n) => n.positionKey === "0-0");
      expect(note?.isInActiveShape).toBe(true);
      expect(note?.isInPatternFretWindow).toBe(true);
    });

    it("equals isInActiveShape everywhere outside the 3NPS-with-a-position branch", () => {
      // Default TOPOLOGY_PROPS has no active pattern/position, so
      // isInPlayableContext (and therefore isInActiveShape) is true for every
      // position — isInPatternFretWindow must short-circuit to the same value.
      const { result } = renderHook(() => useStaticFretboardTopology(TOPOLOGY_PROPS));
      result.current.forEach((note) => {
        expect(note.isInPatternFretWindow).toBe(note.isInActiveShape);
      });
    });
  });

  describe("displayName (issue #493 a11y spelling)", () => {
    // In F major the chromatic "A#" is spelled "Bb". displayName must carry the
    // scale-aware spelling so screen-reader labels match the visible note text.
    const F_MAJOR_PROPS = {
      ...TOPOLOGY_PROPS,
      fretboardLayout: [["F", "F#", "G", "G#", "A", "A#"]],
      totalColumns: 5,
      maxFret: 6,
      highlightNotes: ["F", "G", "A", "A#"],
      chordTones: ["F", "A", "C"],
      rootNote: "F",
      chordRoot: "F",
      tuning: ["F3"],
    };

    it("spells displayName scale-aware, matching displayValue in notes mode", () => {
      const { result } = renderHook(() => useStaticFretboardTopology(F_MAJOR_PROPS));
      const aSharp = result.current.find((note) => note.positionKey === "0-5");
      expect(aSharp?.noteName).toBe("A#");
      expect(aSharp?.displayName).toBe("Bb");
      // In notes mode the visible label IS displayValue, so they must agree.
      expect(aSharp?.displayValue).toBe("Bb");
    });

    it("keeps displayName as the pitch while displayValue becomes a degree", () => {
      const { result } = renderHook(() => useStaticFretboardTopology({
        ...F_MAJOR_PROPS,
        displayFormat: "degrees" as const,
      }));
      const aSharp = result.current.find((note) => note.positionKey === "0-5");
      expect(aSharp?.displayName).toBe("Bb");
      expect(aSharp?.displayValue).not.toBe("Bb");
    });
  });
});
