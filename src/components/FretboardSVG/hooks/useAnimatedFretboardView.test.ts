import React from "react";
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import {
  useAnimatedFretboardView,
  buildRenderedFretboardNotes,
  buildAnimatedFretboardNotes,
} from "./useAnimatedFretboardView";
import type { NoteData } from "./useNoteData";
import { useStaticFretboardTopology } from "./useStaticFretboardTopology";
import type { EmphasisContext } from "./useEmphasisContext";
import type { StaticFretboardTopologyNote } from "./useStaticFretboardTopology";
import {
  setProgressionPlayingAtom,
  progressionStepsAtom,
  beatsPerBarAtom,
  progressionStepDeadlineAtom,
  progressionStepDurationMsAtom,
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
  it("applies guide-target emphasis to the next chord's guide tone while the countdown window is open", () => {
    // With a 1-bar step and the 2-bar countdown window, the countdown spans the
    // full step, so guideCountdownActive is true from the moment playback starts.
    // B is the 3rd of V (G major) — a guide tone for the next chord (step 1).
    const store = makePlayingStore(0.25);
    const wrapper = makeWrapper(store);

    const { result } = renderHook(
      () => {
        const topology = useStaticFretboardTopology(TOPOLOGY_PROPS);
        const view = useAnimatedFretboardView({
          topology,
          hasChordOverlay: true,
          displayFormat: "notes",
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

    const bNote = result.current.view.renderedNotes.find((note) => note.noteName === "B");

    // B is a guide tone of the next chord and the countdown window covers the
    // full 1-bar step — it must receive the guide-target ring immediately.
    expect(bNote?.applyLensEmphasis.transitionRole).toBe("guide-target");
    // Topology must be stable across renders
    const initialTopology = result.current.topology;

    // A frame advance within the same step must not change topology or notes
    // that are already at their correct emphasis.
    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.375,
        localFraction: 0.75,
        paused: false,
      });
    });

    expect(result.current.topology).toBe(initialTopology);
    // B's guide-target emphasis stays the same — countdown is still open.
    const updatedBNote = result.current.view.renderedNotes.find((note) => note.noteName === "B");
    expect(updatedBNote?.applyLensEmphasis.transitionRole).toBe("guide-target");
    // Geometry must be unchanged
    expect(updatedBNote?.cx).toBe(bNote?.cx);
    expect(updatedBNote?.cy).toBe(bNote?.cy);
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

describe("useAnimatedFretboardView — no per-frame recompute", () => {
  it("does not re-run when the visual frame advances within the same step", () => {
    const store = makePlayingStore(0.6);
    // Seed a deadline 30% into the step's remaining time so the step fraction
    // (~0.7) is genuinely inside the countdown window and guideCountdownActiveAtom
    // is TRUE — the invariant under test ("a frame advance within the step does
    // not re-run the hook") matters most while the countdown is on. Without a
    // deadline guideCountdownActive would be false and the test would pass vacuously.
    store.set(progressionStepDeadlineAtom, Date.now() + store.get(progressionStepDurationMsAtom) * 0.3);
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
    expect(renders).toBe(before); // guideCountdownActive unchanged -> no React re-render
  });
});

function makeLensTopologyNote(
  overrides: Partial<StaticFretboardTopologyNote> = {},
): StaticFretboardTopologyNote {
  return {
    stringIndex: 0,
    fretIndex: 5,
    noteName: "D",
    octave: 4,
    noteClass: "chord-tone-in-scale",
    displayName: "D",
    displayValue: "D",
    applyDimOpacity: false,
    isInRegion: true,
    isHidden: false,
    isTension: false,
    isGuideTone: false,
    ...overrides,
  } as StaticFretboardTopologyNote;
}

function makeLensEmphasisContext(
  overrides: Partial<EmphasisContext> = {},
): EmphasisContext {
  return {
    nextGuideTones: new Set(),
    nextGuideToneLabels: new Map(),
    nextChordTones: new Set(),
    incomingTones: new Set(),
    departingTones: new Set(),
    guideCountdownActive: false,
    countdownTicks: [],
    lens: "guide",
    commonTones: new Set(),
    heldTargetTones: new Set(),
    ...overrides,
  };
}

describe("buildAnimatedFretboardNotes — Field lens wiring", () => {
  it("emits hold-common on a common tone under the common lens during the countdown", () => {
    const notes = buildAnimatedFretboardNotes({
      topology: [makeLensTopologyNote({ noteName: "D" })],
      hasChordOverlay: true,
      emphasisContext: makeLensEmphasisContext({
        lens: "common",
        commonTones: new Set(["D"]),
        guideCountdownActive: true,
      }),
    });
    expect(notes[0].transitionRole).toBe("hold-common");
    expect(notes[0].applyLensEmphasis.radiusBoost).toBeGreaterThan(1);
  });

  it("emits hold-guide on a held guide tone under the guide lens during the countdown", () => {
    const notes = buildAnimatedFretboardNotes({
      topology: [makeLensTopologyNote({ noteName: "D" })],
      hasChordOverlay: true,
      emphasisContext: makeLensEmphasisContext({
        lens: "guide",
        nextGuideTones: new Set(["D"]),
        nextGuideToneLabels: new Map([["D", "b3"]]),
        heldTargetTones: new Set(["D"]),
        guideCountdownActive: true,
      }),
    });
    expect(notes[0].transitionRole).toBe("hold-guide");
  });
});

describe("renderedNoteSignature — hold-common is not stale", () => {
  const fretCenterX = (i: number) => i * 10;
  const stringYAt = () => 20;

  it("rebuilds the note object when emphasis flips to hold-common", () => {
    const restingNotes = buildAnimatedFretboardNotes({
      topology: [makeLensTopologyNote({ noteName: "D" })],
      hasChordOverlay: true,
      emphasisContext: makeLensEmphasisContext({ lens: "common", commonTones: new Set(["D"]) }),
    });
    const before = buildRenderedFretboardNotes({ noteData: restingNotes, fretCenterX, stringYAt })[0];

    const holdNotes = buildAnimatedFretboardNotes({
      topology: [makeLensTopologyNote({ noteName: "D" })],
      hasChordOverlay: true,
      emphasisContext: makeLensEmphasisContext({
        lens: "common",
        commonTones: new Set(["D"]),
        guideCountdownActive: true,
      }),
    });
    const after = buildRenderedFretboardNotes({ noteData: holdNotes, fretCenterX, stringYAt })[0];

    // Different transitionRole ⇒ different signature ⇒ NOT the same cached object.
    expect(after).not.toBe(before);
    expect(after.transitionRole).toBe("hold-common");
  });
});
