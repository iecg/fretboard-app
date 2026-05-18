import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { ScaleTheoryFacts } from "./ScaleTheoryFacts";

describe("ScaleTheoryFacts", () => {
  it("renders the Notes, Intervals, Degrees, and Chords fact labels", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Intervals")).toBeInTheDocument();
    expect(screen.getByText("Degrees")).toBeInTheDocument();
    expect(screen.getByText("Chords")).toBeInTheDocument();
    expect(screen.queryByText("Tones")).not.toBeInTheDocument();
  });

  it("lists the diatonic chords of C major", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const chordList = screen.getByRole("list", { name: /diatonic chords for C/i });
    expect(chordList.textContent).toContain("Maj");
    expect(chordList.textContent).toContain("min");
  });

  it("reflects a root change in the listed notes", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "G"],
      [scaleNameAtom, "Major"],
    ]);
    const notesRow = screen.getByText("Notes").closest("div");
    // G major contains F# (or Gb if accidental preference changes).
    expect(notesRow?.textContent).toMatch(/F[#♯]|Gb/);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
