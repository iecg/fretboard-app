import React from "react";
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { useAnimatedFretboardView } from "./useAnimatedFretboardView";
import { useStaticFretboardTopology } from "./useStaticFretboardTopology";
import {
  setProgressionPlayingAtom,
  progressionStepsAtom,
  beatsPerBarAtom,
} from "../../../store/progressionAtoms";
import { progressionVisualFrameAtom } from "../../../store/progressionVisualAtoms";

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

/** Build a store with a I→V progression playing, at a given localFraction. */
function makePlayingStore(localFraction: number) {
  const store = createStore();
  store.set(progressionStepsAtom, [
    { id: "i", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    { id: "v", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  ]);
  store.set(beatsPerBarAtom, 4);
  store.set(setProgressionPlayingAtom, true);
  store.set(progressionVisualFrameAtom, {
    stepIndex: 0,
    globalFraction: localFraction * 0.5,
    localFraction,
    paused: false,
  });
  return store;
}

function makeWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children);
}

describe("useAnimatedFretboardView", () => {
  it("updates rendered notes when emphasis context crosses the anticipation threshold", () => {
    // Beat 1 of 4 (localFraction=0.25) → below anticipation threshold (0.75)
    const store = makePlayingStore(0.25);
    const wrapper = makeWrapper(store);

    const { result } = renderHook(
      () => {
        const topology = useStaticFretboardTopology(TOPOLOGY_PROPS);
        const view = useAnimatedFretboardView({
          topology,
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
      { wrapper },
    );

    const initialTopology = result.current.topology;
    const initialView = result.current.view;
    const initialBNote = initialView.renderedNotes.find((note) => note.noteName === "B");

    // Advance to beat 3 of 4 (localFraction=0.75) → crosses anticipation threshold
    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.375,
        localFraction: 0.75,
        paused: false,
      });
    });

    const updatedView = result.current.view;
    const updatedBNote = result.current.view.renderedNotes.find((note) => note.noteName === "B");

    // Topology must be stable — only emphasis changed
    expect(result.current.topology).toBe(initialTopology);
    // noteData and renderedNotes must be new references (emphasis changed)
    expect(updatedView.noteData).not.toBe(initialView.noteData);
    expect(updatedView.renderedNotes).not.toBe(initialView.renderedNotes);
    // B is a guide tone of V (G major) — should get anticipation glow at beat 3
    expect(updatedBNote?.applyLensEmphasis).not.toEqual(initialBNote?.applyLensEmphasis);
    // Geometry must be unchanged
    expect(updatedBNote?.cx).toBe(initialBNote?.cx);
    expect(updatedBNote?.cy).toBe(initialBNote?.cy);
  });

  it("keeps noteData reference-stable when the frame advances within a step (below anticipation threshold)", () => {
    // Beat 1 of 4 (localFraction=0.25) → below anticipation threshold (0.75)
    const store = makePlayingStore(0.25);
    const wrapper = makeWrapper(store);

    const { result } = renderHook(
      () => {
        const topology = useStaticFretboardTopology(TOPOLOGY_PROPS);
        const view = useAnimatedFretboardView({
          topology,
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
      { wrapper },
    );

    const initialNoteData = result.current.view.noteData;

    // Advance the frame within the same step — localFraction changes (0.25 → 0.50)
    // but stays below the 0.75 anticipation threshold and stepIndex is unchanged.
    // Emphasis must NOT recompute: noteData keeps the same reference.
    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.25,
        localFraction: 0.5,
        paused: false,
      });
    });

    expect(result.current.view.noteData).toBe(initialNoteData);
  });
});
