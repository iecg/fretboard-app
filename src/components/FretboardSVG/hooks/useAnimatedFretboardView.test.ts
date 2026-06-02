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

describe("buildRenderedFretboardNotes — voice-leading offsets", () => {
  function makeNoteData(
    o: Partial<NoteData> & Pick<NoteData, "stringIndex" | "fretIndex">,
  ): NoteData {
    return {
      noteName: "C",
      octave: 4,
      noteClass: "chord-tone-in-scale",
      displayName: "C",
      displayValue: "C",
      applyDimOpacity: false,
      applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
      isInRegion: true,
      isHidden: false,
      isTension: false,
      isGuideTone: false,
      ...o,
    };
  }

  it("stamps voiceLeadOffset on a paired incoming target, not on the source", () => {
    const noteData = [
      makeNoteData({ stringIndex: 0, fretIndex: 10, transitionRole: "incoming" }),
      makeNoteData({ stringIndex: 1, fretIndex: 11, transitionRole: "departing" }),
    ];
    // fretCenterX = fret*10, stringYAt = string*20 (module consts in this test file):
    //   target string0 fret10 -> cx 100, cy 0
    //   source string1 fret11 -> cx 110, cy 20  (dist hypot(10,20) ≈ 22.4 ≥ 8)
    const rendered = buildRenderedFretboardNotes({ noteData, fretCenterX, stringYAt });
    const target = rendered.find((n) => n.stringIndex === 0 && n.fretIndex === 10)!;
    const source = rendered.find((n) => n.stringIndex === 1 && n.fretIndex === 11)!;
    expect(target.voiceLeadOffset).toEqual({ dx: 10, dy: 20 });
    expect(source.voiceLeadOffset).toBeUndefined();
  });

  it("leaves voiceLeadOffset undefined when no transition roles are present", () => {
    const noteData = [
      makeNoteData({ stringIndex: 0, fretIndex: 3 }),
      makeNoteData({ stringIndex: 1, fretIndex: 4 }),
    ];
    const rendered = buildRenderedFretboardNotes({ noteData, fretCenterX, stringYAt });
    expect(rendered.every((n) => n.voiceLeadOffset === undefined)).toBe(true);
  });
});

describe("useAnimatedFretboardView — no per-frame recompute", () => {
  it("does not re-run when the visual frame advances within the same step", () => {
    const store = makePlayingStore(0.6); // already inside the lead-in window
    const wrapper = makeWrapper(store);
    let renders = 0;
    renderHook(
      () => {
        renders++;
        const topology = useStaticFretboardTopology(TOPOLOGY_PROPS);
        return useAnimatedFretboardView({
          topology,
          hasChordOverlay: true,
          fretCenterX,
          stringYAt,
        });
      },
      { wrapper },
    );
    const before = renders;
    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.35,
        localFraction: 0.7,
        paused: false,
      });
    });
    expect(renders).toBe(before); // leadInActive unchanged -> no React re-render
  });
});
