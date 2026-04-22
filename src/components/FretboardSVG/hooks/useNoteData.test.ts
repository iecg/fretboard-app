import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNoteData } from "./useNoteData";

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
        tuning: ["E2", "A2", "D3", "G3", "B3", "E4"]
      })
    );

    const data = result.current;
    expect(data.length).toBeGreaterThan(0);
    const e2Note = data.find(n => n.noteName === "E" && n.fretIndex === 0 && n.stringIndex === 0);
    expect(e2Note).toBeDefined();
    expect(e2Note?.noteClass).toBe("key-tonic");
  });
});

