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
  hiddenNotes: new Set<string>(),
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
  degreeColorsEnabled: true,
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

  it("marks notes covered by polygon ranges and ignores truncated polygons", () => {
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
    expect(result.current.find((note) => note.positionKey === "0-1")?.isInsideAnyPolygon).toBe(false);
    expect(result.current.find((note) => note.positionKey === "1-4")?.isInsideAnyPolygon).toBe(true);
    expect(result.current.find((note) => note.positionKey === "1-3")?.isInsideAnyPolygon).toBe(false);
  });
});
