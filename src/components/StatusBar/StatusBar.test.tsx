// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import {
  chordRootAtom,
  chordTypeAtom,
  chordDegreeAtom,
  cagedShapesAtom,
  fingeringPatternAtom,
  fretStartAtom,
  fretEndAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  tuningNameAtom,
} from "../../store/atoms";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("renders all seven field labels and the version badge", () => {
    renderWithAtoms(<StatusBar />);
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
    for (const label of ["Key", "Chord", "Lens", "Pattern", "Frets", "Tempo", "Tuning"]) {
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
    // practiceLensAtom defaults to "targets" -> compact lens label "Chord".
    expect(screen.getByTestId("status-lens")).toHaveTextContent("Chord");
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
      [progressionStepsAtom, []],
      [chordRootAtom, "G"],
      [chordTypeAtom, "Minor Triad"],
    ]);
    expect(screen.getByTestId("status-chord")).toHaveTextContent("Gm");
  });

  it("prefixes the chord degree when one is set", () => {
    // Progression is not the active chord source by default, so
    // effectiveChordDegreeAtom falls back to chordDegreeAtom.
    renderWithAtoms(<StatusBar />, [
      [progressionStepsAtom, []],
      [chordRootAtom, "G"],
      [chordTypeAtom, "Major Triad"],
      [chordDegreeAtom, "V"],
    ]);
    expect(screen.getByTestId("status-chord")).toHaveTextContent("V · G");
  });
});
