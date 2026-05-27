import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
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

  describe("chordDegree assignment", () => {
    it("assigns chord-degree 1, 3, 5 for a G major triad", () => {
      const { result } = renderHook(() =>
        useStaticFretboardTopology({
          ...TOPOLOGY_PROPS,
          chordRoot: "G",
          chordType: "M",
          chordTones: ["G", "B", "D"],
          rootNote: "G",
        }),
      );

      const notes = result.current;
      const gNotes = notes.filter((n) => n.noteName === "G" && n.chordDegree);
      const bNotes = notes.filter((n) => n.noteName === "B" && n.chordDegree);

      expect(gNotes.some((n) => n.chordDegree === "1")).toBe(true);
      expect(bNotes.some((n) => n.chordDegree === "3")).toBe(true);
    });

    it("assigns chord-degree 1, 3, 5, 7 for G7", () => {
      const { result } = renderHook(() =>
        useStaticFretboardTopology({
          ...TOPOLOGY_PROPS,
          fretboardLayout: [["G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E", "F"]],
          totalColumns: 10,
          maxFret: 11,
          chordRoot: "G",
          chordType: "7",
          chordTones: ["G", "B", "D", "F"],
          rootNote: "G",
          tuning: ["G3"],
        }),
      );

      const notes = result.current;
      const gNotes = notes.filter((n) => n.noteName === "G" && n.chordDegree);
      const bNotes = notes.filter((n) => n.noteName === "B" && n.chordDegree);
      const fNotes = notes.filter((n) => n.noteName === "F" && n.chordDegree);

      expect(gNotes.some((n) => n.chordDegree === "1")).toBe(true);
      expect(bNotes.some((n) => n.chordDegree === "3")).toBe(true);
      expect(fNotes.some((n) => n.chordDegree === "7")).toBe(true);
    });

    it("does not assign chordDegree to non-chord-tone notes", () => {
      const { result } = renderHook(() =>
        useStaticFretboardTopology({
          ...TOPOLOGY_PROPS,
          chordRoot: "G",
          chordType: "M",
          chordTones: ["G", "B", "D"],
          rootNote: "G",
          degreeColorsEnabled: false,
        }),
      );

      const chordNotes = result.current.filter((n) => n.chordDegree);
      const nonChordNotes = result.current.filter(
        (n) => n.noteClass === "scale-only" || n.noteClass === "note-inactive",
      );

      expect(nonChordNotes.every((n) => n.chordDegree === undefined)).toBe(true);
      expect(chordNotes.length).toBeGreaterThan(0);
    });

    it("assigns correct chordDegree for C major chord across multiple strings", () => {
      const { result } = renderHook(() =>
        useStaticFretboardTopology({
          numStrings: 6,
          fretboardLayout: [
            ["E", "F", "F#", "G", "G#", "A"],
            ["B", "C", "C#", "D", "D#", "E"],
            ["G", "G#", "A", "A#", "B", "C"],
            ["D", "D#", "E", "F", "F#", "G"],
            ["A", "A#", "B", "C", "C#", "D"],
            ["E", "F", "F#", "G", "G#", "A"],
          ],
          totalColumns: 5,
          startFret: 0,
          maxFret: 5,
          hasChordOverlay: true,
          chordTones: ["C", "E", "G"],
          rootNote: "C",
          chordRoot: "C",
          chordType: "M",
          colorNotes: [],
          shapePolygons: [],
          chordBoxBounds: null,
          chordFretSpread: 0,
          scaleName: "major",
          preferFlats: false,
          displayFormat: "notes",
          degreeColorsEnabled: false,
          wrappedNotes: new Set(),
          highlightNotes: [],
          tuning: ["E4", "B3", "G3", "D3", "A2", "E2"],
          hiddenNotes: new Set(),
        }),
      );

      const notes = result.current;
      const cNotes = notes.filter((n) => n.noteName === "C" && n.chordDegree);
      const eNotes = notes.filter((n) => n.noteName === "E" && n.chordDegree);
      const gNotes = notes.filter((n) => n.noteName === "G" && n.chordDegree);

      expect(cNotes.some((n) => n.chordDegree === "1")).toBe(true);
      expect(eNotes.some((n) => n.chordDegree === "3")).toBe(true);
      expect(gNotes.some((n) => n.chordDegree === "5")).toBe(true);
    });
  });
});
