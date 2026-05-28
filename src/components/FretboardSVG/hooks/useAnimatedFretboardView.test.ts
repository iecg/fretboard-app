import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAnimatedFretboardView } from "./useAnimatedFretboardView";
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

const fretCenterX = (fretIndex: number) => fretIndex * 10;
const stringYAt = (stringIndex: number) => stringIndex * 20;

describe("useAnimatedFretboardView", () => {
  it("updates rendered notes from playback changes without rebuilding topology", () => {
    const { result, rerender } = renderHook(
      ({ beatPosition }) => {
        const topology = useStaticFretboardTopology(TOPOLOGY_PROPS);
        const view = useAnimatedFretboardView({
          topology,
          playbackSnapshot: {
            playing: true,
            activeStepIndex: 0,
            globalFraction: beatPosition / 4,
            localFraction: beatPosition / 4,
            stepDurationBeats: 4,
            beatPosition,
            commonWithNext: new Set<string>(),
            nextGuideTones: new Set(["B"]),
          },
          hasChordOverlay: true,
          displayFormat: "notes",
          degreeColorsEnabled: true,
          preferFlats: false,
          scaleName: "major",
          rootNote: "G",
          fretCenterX,
          stringYAt,
        });

        return { topology, view };
      },
      { initialProps: { beatPosition: 1 } },
    );

    const initialTopology = result.current.topology;
    const initialView = result.current.view;
    const initialBNote = initialView.renderedNotes.find((note) => note.noteName === "B");

    rerender({ beatPosition: 3 });

    const updatedView = result.current.view;
    const updatedBNote = result.current.view.renderedNotes.find((note) => note.noteName === "B");

    expect(result.current.topology).toBe(initialTopology);
    expect(updatedView.noteData).not.toBe(initialView.noteData);
    expect(updatedView.renderedNotes).not.toBe(initialView.renderedNotes);
    expect(updatedBNote?.applyLensEmphasis).not.toEqual(initialBNote?.applyLensEmphasis);
    expect(updatedBNote?.cx).toBe(initialBNote?.cx);
    expect(updatedBNote?.cy).toBe(initialBNote?.cy);
  });
});
