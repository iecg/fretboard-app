// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { cagedShapesAtom, fingeringPatternAtom } from "../../store/fingeringAtoms";
import { fretStartAtom, fretEndAtom, tuningNameAtom } from "../../store/layoutAtoms";
import { addProgressionStepAtom, progressionStepsAtom, progressionTempoBpmAtom } from "../../store/progressionAtoms";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("renders all eight field labels and the version badge", () => {
    renderWithAtoms(<StatusBar />);
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
    for (const label of ["Key", "Chord", "Lens", "Pattern", "Frets", "Tempo", "Progression", "Tuning"]) {
      // Scope to the label span — a value (e.g. the "Chord" lens) can share the text.
      expect(screen.getByText(label, { selector: ".label" })).toBeInTheDocument();
    }
    expect(screen.getByTestId("status-version")).toBeInTheDocument();
    expect(screen.getByTestId("status-version")).toHaveTextContent("FretFlow Studio");
  });

  it("shows the fret window from fretStartAtom/fretEndAtom", () => {
    renderWithAtoms(<StatusBar />, [
      [fretStartAtom, 3],
      [fretEndAtom, 12],
    ]);
    expect(screen.getByTestId("status-frets")).toHaveTextContent("3–12");
  });

  it("shows the tempo with a BPM suffix", () => {
    renderWithAtoms(<StatusBar />, [[progressionTempoBpmAtom, 90]]);
    expect(screen.getByTestId("status-tempo")).toHaveTextContent("90 BPM");
  });

  it("shows the tuning name", () => {
    renderWithAtoms(<StatusBar />, [[tuningNameAtom, "Drop D"]]);
    expect(screen.getByTestId("status-tuning")).toHaveTextContent("Drop D");
  });

  it("shows the active lens label by default", () => {
    renderWithAtoms(<StatusBar />);
    // practiceLensAtom defaults to "tones" -> compact lens label "Tones".
    expect(screen.getByTestId("status-lens")).toHaveTextContent("Tones");
  });

  it("labels a non-CAGED pattern", () => {
    renderWithAtoms(<StatusBar />, [[fingeringPatternAtom, "3nps"]]);
    expect(screen.getByTestId("status-pattern")).toHaveTextContent("3NPS");
  });

  it("appends the active shapes for the CAGED pattern", () => {
    renderWithAtoms(<StatusBar />, [
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set(["G", "C", "A"])],
    ]);
    // Shapes render in CAGED_SHAPES order ("C","A","G","E","D"), not Set order.
    expect(screen.getByTestId("status-pattern")).toHaveTextContent("CAGED · CAG");
  });

  it("shows a dash for the chord when no chord overlay is active", () => {
    renderWithAtoms(<StatusBar />, [[progressionStepsAtom, []]]);
    expect(screen.getByTestId("status-chord")).toHaveTextContent("—");
  });

  it("shows the compact chord symbol when a chord is active", () => {
    renderWithAtoms(<StatusBar />, [
      [progressionStepsAtom, [
        {
          id: "one",
          degree: "I",
          duration: { value: 1, unit: "bar" },
          qualityOverride: "m",
          manualRoot: "G",
        },
      ]],
    ]);
    expect(screen.getByTestId("status-chord")).toHaveTextContent("Gm");
  });

  it("prefixes the chord degree when one is set", () => {
    renderWithAtoms(<StatusBar />, [
      [progressionStepsAtom, [
        {
          id: "one",
          degree: "V",
          duration: { value: 1, unit: "bar" },
          qualityOverride: "M",
          manualRoot: "G",
        },
      ]],
    ]);
    expect(screen.getByTestId("status-chord")).toHaveTextContent("V · G");
  });

  it("shows the progression length field with a 4-step, 4-bar seed", () => {
    // Seed 4 steps each of 1 bar = 4 bars, 4 chords.
    const fourSteps = [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "c", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "d", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ] as const;
    renderWithAtoms(<StatusBar />, [[progressionStepsAtom, fourSteps]]);
    expect(screen.getByTestId("status-progression")).toHaveTextContent("4 bars · 4 chords");
  });

  it("updates the progression count when a step is added via addProgressionStepAtom", () => {
    const threeSteps = [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "c", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ];
    const store = makeAtomStore([[progressionStepsAtom, threeSteps]]);
    renderWithStore(<StatusBar />, store);
    // Seeded with 3 steps: 3 bars · 3 chords.
    expect(screen.getByTestId("status-progression")).toHaveTextContent("3 bars · 3 chords");
    // Add one step — addProgressionStepAtom appends a new 1-bar step.
    act(() => { store.set(addProgressionStepAtom); });
    expect(screen.getByTestId("status-progression")).toHaveTextContent("4 bars · 4 chords");
  });
});
