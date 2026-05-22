// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { STANDARD_TUNING } from "@fretflow/core";
import { fullChordsEnabledAtom } from "../../store/chordOverlayAtoms";
import { cagedShapesAtom, fingeringPatternAtom } from "../../store/fingeringAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/scaleAtoms";
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
  // Set scale root + scale BEFORE seeding the progression step so the
  // root-change listener doesn't transpose manualRoot from the default key.
  store.set(rootNoteAtom, "G");
  store.set(scaleNameAtom, "Major");
  store.set(progressionStepsAtom, [
    {
      id: "step-1",
      degree: "I",
      duration: { value: 1, unit: "bar" },
      qualityOverride: chordType,
      manualRoot: chordRoot,
    },
  ]);
  store.set(fullChordsEnabledAtom, true);
  store.set(fingeringPatternAtom, "caged");
  store.set(cagedShapesAtom, new Set(["E"]));
  // v2.0: shape narrowing happens in voicingMatchesAtom when cagedShapesAtom
  // has exactly one shape. The legacy chordScopeToPosition flag would invoke
  // a redundant downstream position filter in useFretboardState and prune
  // voicings outside the active scale window — leave it off here so the
  // atom-layer narrowing is what's asserted.

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
    store.set(progressionStepsAtom, [
      {
        id: "step-1",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: "Major Triad",
        manualRoot: "E",
      },
    ]);
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
    // Notes use expect.objectContaining because VoicingNote includes a `midi` field
    // that FullChordMatchNote did not; we only assert on the fretboard-position fields.
    expect(lastCall.fullChordVoicings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shape: "E",
          voicingKey: "0,0|1,0|2,1|3,2|4,2|5,0",
          notes: [
            expect.objectContaining({ stringIndex: 0, fretIndex: 0, noteName: "E" }),
            expect.objectContaining({ stringIndex: 1, fretIndex: 0, noteName: "B" }),
            expect.objectContaining({ stringIndex: 2, fretIndex: 1, noteName: "G#" }),
            expect.objectContaining({ stringIndex: 3, fretIndex: 2, noteName: "E" }),
            expect.objectContaining({ stringIndex: 4, fretIndex: 2, noteName: "B" }),
            expect.objectContaining({ stringIndex: 5, fretIndex: 0, noteName: "E" }),
          ],
        }),
      ]),
    );
  });

  it("narrows full-chord voicings to the active CAGED shape per chord", () => {
    // v2.0: when a single CAGED shape is active, voicingMatchesAtom filters by
    // literal shape name (every voicing has v.shape === active). The retired
    // v1 fret-window-overlap selection (which picked A-shape B minor inside
    // the E-position G-major window, for example) is gone.
    const tonic = renderGMajorEPositionChord("G", "Major Triad");
    expect(tonic.fullChordVoicings?.length).toBeGreaterThan(0);
    expect(tonic.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);

    const mediant = renderGMajorEPositionChord("B", "Minor Triad");
    expect(mediant.fullChordVoicings?.length).toBeGreaterThan(0);
    expect(mediant.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);

    const subdominant = renderGMajorEPositionChord("C", "Major Triad");
    expect(subdominant.fullChordVoicings?.length).toBeGreaterThan(0);
    expect(subdominant.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);
  });

  it("keeps exact full-chord notes outside the selected CAGED scale position when the voicing mostly overlaps", () => {
    const supertonic = renderGMajorEPositionChord("A", "Minor Triad");
    expect(supertonic.fullChordVoicings?.some((voicing) => voicing.shape === "E")).toBe(true);
    expect(supertonic.fullChordPositionKeys?.has("0-5")).toBe(true);
    expect(supertonic.fullChordPositionKeys?.has("3-7")).toBe(true);
    expect(supertonic.fullChordPositionKeys?.has("4-7")).toBe(true);
  });

  it("narrows full-chord voicings to the active CAGED shape regardless of fret position", () => {
    // v2.0: D major's E-shape voicing sits at the 10th-fret area, well outside
    // the E-position window for G major (~frets 2–6). The v1 engine selected
    // a C-shape voicing because it overlapped the window; v2.0 returns only
    // E-shape voicings regardless of overlap.
    const dominant = renderGMajorEPositionChord("D", "Major Triad");
    expect(dominant.fullChordVoicings?.length).toBeGreaterThan(0);
    expect(dominant.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);
  });
});
