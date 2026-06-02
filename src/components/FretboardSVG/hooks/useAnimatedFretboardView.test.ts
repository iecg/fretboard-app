import React from "react";
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { useAnimatedFretboardView, buildRenderedFretboardNotes } from "./useAnimatedFretboardView";
import type { NoteData } from "./useNoteData";
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
  it("updates rendered notes when emphasis context crosses the lead-in threshold", () => {
    // localFraction=0.25 → below the lead-in window threshold (0.5)
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

    // Advance to localFraction=0.75 → crosses into the lead-in window
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
    // B is the 3rd of V (G major) — an incoming tone the next chord introduces,
    // so its emphasis must change once the lead-in window opens.
    expect(updatedBNote?.applyLensEmphasis).not.toEqual(initialBNote?.applyLensEmphasis);
    // Geometry must be unchanged
    expect(updatedBNote?.cx).toBe(initialBNote?.cx);
    expect(updatedBNote?.cy).toBe(initialBNote?.cy);
  });

  it("keeps noteData reference-stable when the frame advances within a step (below lead-in threshold)", () => {
    // localFraction=0.25 → below the lead-in window threshold (0.5)
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

    // Advance the frame within the same step — localFraction changes (0.25 → 0.40)
    // but stays below the lead-in window threshold (0.5) and stepIndex is unchanged.
    // Emphasis must NOT recompute: noteData keeps the same reference.
    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.2,
        localFraction: 0.4,
        paused: false,
      });
    });

    expect(result.current.view.noteData).toBe(initialNoteData);
  });
});

describe("buildRenderedFretboardNotes (object identity)", () => {
  function makeNote(overrides: Partial<NoteData> = {}): NoteData {
    return {
      stringIndex: 0,
      fretIndex: 0,
      noteName: "C",
      octave: 4,
      noteClass: "note-active",
      displayName: "C",
      displayValue: "C",
      applyDimOpacity: false,
      applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
      isInRegion: true,
      isHidden: false,
      isTension: false,
      isGuideTone: false,
      ...overrides,
    };
  }

  const fretCenterX = (fretIndex: number) => fretIndex * 10;
  const stringYAt = (stringIndex: number) => stringIndex * 20;

  it("returns the same object reference when a note's inputs are unchanged", () => {
    const noteData: NoteData[] = [
      makeNote({ stringIndex: 0, fretIndex: 3, noteName: "C" }),
      makeNote({ stringIndex: 2, fretIndex: 5, noteName: "E" }),
    ];

    const a = buildRenderedFretboardNotes({ noteData, fretCenterX, stringYAt });

    // Fresh, structurally-identical input objects on the second call.
    const noteDataAgain: NoteData[] = [
      makeNote({ stringIndex: 0, fretIndex: 3, noteName: "C" }),
      makeNote({ stringIndex: 2, fretIndex: 5, noteName: "E" }),
    ];

    const b = buildRenderedFretboardNotes({
      noteData: noteDataAgain,
      fretCenterX,
      stringYAt,
    });

    expect(b[0]).toBe(a[0]);
    expect(b[1]).toBe(a[1]);
  });

  it("rebuilds only the note whose emphasis-affecting input changed", () => {
    const noteData: NoteData[] = [
      makeNote({ stringIndex: 0, fretIndex: 3, noteName: "C" }),
      makeNote({ stringIndex: 2, fretIndex: 5, noteName: "E" }),
    ];

    const a = buildRenderedFretboardNotes({ noteData, fretCenterX, stringYAt });

    const noteDataChanged: NoteData[] = [
      makeNote({ stringIndex: 0, fretIndex: 3, noteName: "C" }),
      makeNote({
        stringIndex: 2,
        fretIndex: 5,
        noteName: "E",
        applyLensEmphasis: { radiusBoost: 1.5, opacityBoost: 1 },
      }),
    ];

    const b = buildRenderedFretboardNotes({
      noteData: noteDataChanged,
      fretCenterX,
      stringYAt,
    });

    // Unchanged note keeps identity; changed note is a fresh object.
    expect(b[0]).toBe(a[0]);
    expect(b[1]).not.toBe(a[1]);
  });
});
