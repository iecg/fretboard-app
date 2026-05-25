// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { STANDARD_TUNING } from "@fretflow/core";
import { fullChordsEnabledAtom } from "../../store/chordOverlayAtoms";
import { cagedShapesAtom, fingeringPatternAtom } from "../../store/fingeringAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/scaleAtoms";
import { Fretboard } from "./Fretboard";
// Prime the lazy chunk so React.lazy() resolves on first microtask in jsdom.
import "../FretboardSVG/FretboardSVG";

async function flushSuspense() {
  await act(async () => {
    await Promise.resolve();
  });
}

const fretboardSvgSpy = vi.fn();

vi.mock("../FretboardSVG/FretboardSVG", () => ({
  FretboardSVG: (props: unknown) => {
    fretboardSvgSpy(props);
    return <div data-testid="fretboard-svg" />;
  },
}));

async function renderGMajorEPositionChord(chordRoot: string, chordType: string) {
  const store = createStore();
  // Set scale root + scale BEFORE seeding the progression step so the
  // root-change listener doesn't transpose manualRoot from the default key.
  store.set(rootNoteAtom, "G");
  store.set(scaleNameAtom, "major");
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
  await flushSuspense();

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

  it("passes full chord positions and voicings from state into FretboardSVG", async () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      {
        id: "step-1",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: "M",
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
    await flushSuspense();

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

  it("narrows full-chord voicings to the active CAGED shape per chord", async () => {
    // Under Diatonic CAGED Chord Shape Alignment, when a single CAGED shape is active,
    // we dynamically select the chord shape that actually fits that scale shape's fret position
    // instead of forcing the exact same letter shape, preventing 1-position offsets.
    const tonic = await renderGMajorEPositionChord("G", "M");
    expect(tonic.fullChordVoicings?.length).toBeGreaterThan(0);
    expect(tonic.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);

    const mediant = await renderGMajorEPositionChord("B", "m");
    expect(mediant.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);
    // Bm root at string 4 fret 14 is inside the remapped D-shape polygon
    // (relative minor anchor for G Major maps E→D, so roots are at fret 2 and 14).
    expect(mediant.fullChordPositionKeys?.has("4-14")).toBe(true);

    const subdominant = await renderGMajorEPositionChord("C", "M");
    expect(subdominant.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);
    expect(subdominant.fullChordPositionKeys?.has("4-15")).toBe(true);
  });

  it("filters out full-chord notes outside the selected CAGED scale position when lock-to-scale is on", async () => {
    const supertonic = await renderGMajorEPositionChord("D#", "m");
    expect(supertonic.fullChordVoicings?.some((voicing) => voicing.shape === "E")).toBe(true);
    // D#m root at string 3 fret 1 is outside the E-shape's diagonal bounds at fret 3.
    expect(supertonic.fullChordPositionKeys?.has("3-1")).toBe(false);
  });

  it("narrows full-chord voicings to the best-fitting shape in that fret position", async () => {
    // Under Diatonic CAGED Chord Shape Alignment, D major's C-shape sits at the 2nd-fret area,
    // perfectly overlapping the E-position window for G major (~frets 2–6).
    const dominant = await renderGMajorEPositionChord("D", "M");
    expect(dominant.fullChordVoicings?.every((voicing) => voicing.shape === "E")).toBe(true);
    expect(dominant.fullChordPositionKeys?.has("4-5")).toBe(true);
    expect(dominant.fullChordPositionKeys?.has("3-0")).toBe(false);
  });
});
