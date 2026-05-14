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
} from "../../store/atoms";
import { Fretboard } from "./Fretboard";

const fretboardSvgSpy = vi.fn();

vi.mock("../FretboardSVG/FretboardSVG", () => ({
  FretboardSVG: (props: unknown) => {
    fretboardSvgSpy(props);
    return <div data-testid="fretboard-svg" />;
  },
}));

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

  it("filters full chord matches to the selected CAGED shapes before passing them into FretboardSVG", () => {
    const store = createStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "Major Triad");
    store.set(fullChordsEnabledAtom, true);
    store.set(fingeringPatternAtom, "caged");
    store.set(cagedShapesAtom, new Set(["E"]));

    render(
      <Provider store={store}>
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={["C", "E", "G"]}
          rootNote="C"
          displayFormat="notes"
        />
      </Provider>,
    );

    const lastCall = fretboardSvgSpy.mock.calls.at(-1)?.[0] as {
      fullChordPositionKeys?: Set<string>;
      fullChordVoicings?: Array<{ shape?: string; voicingKey: string }>;
    };

    expect(lastCall.fullChordVoicings).toBeDefined();
    expect(lastCall.fullChordVoicings).not.toHaveLength(0);
    expect(lastCall.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);
    expect(lastCall.fullChordPositionKeys?.has("4-3")).toBe(false);
  });
});
