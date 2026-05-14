// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { STANDARD_TUNING } from "@fretflow/core";
import {
  cagedShapesAtom,
  chordOverlayModeAtom,
  chordRootAtom,
  chordTypeAtom,
  fingeringPatternAtom,
  fullChordsEnabledAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "../../store/atoms";
import { Fretboard } from "./Fretboard";

const fretboardSvgSpy = vi.fn();

vi.mock("../FretboardSVG/FretboardSVG", () => ({
  FretboardSVG: (props: unknown) => {
    fretboardSvgSpy(props);
    return <div data-testid="fretboard-svg" />;
  },
}));

function renderGMajorEPositionChord(chordRoot: string, chordType: string) {
  const store = createStore();
  store.set(chordOverlayModeAtom, "manual");
  store.set(rootNoteAtom, "G");
  store.set(scaleNameAtom, "Major");
  store.set(chordRootAtom, chordRoot);
  store.set(chordTypeAtom, chordType);
  store.set(fullChordsEnabledAtom, true);
  store.set(fingeringPatternAtom, "caged");
  store.set(cagedShapesAtom, new Set(["E"]));

  const { unmount } = render(
    <Provider store={store}>
      <Fretboard
        tuning={STANDARD_TUNING}
        maxFret={24}
        highlightNotes={["G", "A", "B", "C", "D", "E", "F#"]}
        rootNote="G"
        displayFormat="notes"
      />
    </Provider>,
  );

  const lastCall = fretboardSvgSpy.mock.calls.at(-1)?.[0] as {
    fullChordPositionKeys?: Set<string>;
    fullChordVoicings?: Array<{ shape?: string; voicingKey: string }>;
  };

  unmount();
  fretboardSvgSpy.mockClear();
  return lastCall;
}

describe("Fretboard wiring", () => {
  beforeEach(() => {
    localStorage.clear();
    fretboardSvgSpy.mockClear();
  });

  it("passes full chord positions and voicings from state into FretboardSVG", () => {
    const store = createStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootAtom, "E");
    store.set(chordTypeAtom, "Major Triad");
    store.set(fullChordsEnabledAtom, true);

    render(
      <Provider store={store}>
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={["E", "G#", "B"]}
          rootNote="E"
          displayFormat="notes"
        />
      </Provider>,
    );

    const lastCall = fretboardSvgSpy.mock.calls.at(-1)?.[0] as {
      fullChordPositionKeys?: Set<string>;
      fullChordVoicings?: Array<{
        shape?: string;
        voicingKey: string;
        notes: Array<{ stringIndex: number; fretIndex: number; noteName: string }>;
      }>;
    };

    // Wiring test: verify state.fullChordPositions flows into fullChordPositionKeys
    expect(lastCall.fullChordPositionKeys).toBeInstanceOf(Set);
    expect(lastCall.fullChordPositionKeys?.has("0-0")).toBe(true);
    expect(lastCall.fullChordPositionKeys?.has("1-0")).toBe(true);
    expect(lastCall.fullChordPositionKeys?.has("2-1")).toBe(true);
    expect(lastCall.fullChordPositionKeys?.has("3-2")).toBe(true);
    expect(lastCall.fullChordPositionKeys?.has("4-2")).toBe(true);
    expect(lastCall.fullChordPositionKeys?.has("5-0")).toBe(true);

    // Wiring test: verify state.fullChordMatches flows into fullChordVoicings
    expect(lastCall.fullChordVoicings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shape: "E",
          voicingKey: "0,0|1,0|2,1|3,2|4,2|5,0",
          notes: [
            { stringIndex: 0, fretIndex: 0, noteName: "E" },
            { stringIndex: 1, fretIndex: 0, noteName: "B" },
            { stringIndex: 2, fretIndex: 1, noteName: "G#" },
            { stringIndex: 3, fretIndex: 2, noteName: "E" },
            { stringIndex: 4, fretIndex: 2, noteName: "B" },
            { stringIndex: 5, fretIndex: 0, noteName: "E" },
          ],
        }),
      ]),
    );
  });

  it("chooses the full chord form that fits inside the selected CAGED scale position per chord", () => {
    const tonic = renderGMajorEPositionChord("G", "Major Triad");
    expect(tonic.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);
    expect(tonic.fullChordPositionKeys?.has("5-15")).toBe(true);

    const mediant = renderGMajorEPositionChord("B", "Minor Triad");
    expect(mediant.fullChordVoicings?.every((voicing) => voicing.shape === "A")).toBe(true);
    expect(mediant.fullChordPositionKeys?.has("4-14")).toBe(true);

    const subdominant = renderGMajorEPositionChord("C", "Major Triad");
    expect(subdominant.fullChordVoicings?.every((voicing) => voicing.shape === "A")).toBe(true);
    expect(subdominant.fullChordPositionKeys?.has("4-15")).toBe(true);
  });

  it("keeps exact full-chord notes outside the selected CAGED scale position when the voicing mostly overlaps", () => {
    const supertonic = renderGMajorEPositionChord("A", "Minor Triad");
    expect(supertonic.fullChordVoicings?.some((voicing) => voicing.shape === "E")).toBe(true);
    expect(supertonic.fullChordPositionKeys?.has("0-5")).toBe(true);
    expect(supertonic.fullChordPositionKeys?.has("3-7")).toBe(true);
    expect(supertonic.fullChordPositionKeys?.has("4-7")).toBe(true);
  });

  it("uses one full-chord form per CAGED position and prefers one that fits fully inside", () => {
    const dominant = renderGMajorEPositionChord("D", "Major Triad");
    expect(dominant.fullChordVoicings?.every((voicing) => voicing.shape === "C")).toBe(true);
    expect(dominant.fullChordPositionKeys?.has("4-5")).toBe(true);
    expect(dominant.fullChordPositionKeys?.has("3-0")).toBe(false);
  });
});
