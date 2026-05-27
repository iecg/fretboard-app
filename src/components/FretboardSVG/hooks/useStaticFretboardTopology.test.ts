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
});
