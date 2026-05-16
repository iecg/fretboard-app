import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { rootNoteAtom, scaleNameAtom } from "../../store/atoms";
import { ScaleTheoryFacts } from "./ScaleTheoryFacts";

describe("ScaleTheoryFacts", () => {
  it("renders the Notes, Intervals, Degrees, and Tones fact labels", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Intervals")).toBeInTheDocument();
    expect(screen.getByText("Degrees")).toBeInTheDocument();
    expect(screen.getByText("Tones")).toBeInTheDocument();
  });

  it("lists the notes of C major and reports a tone count of 7", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    const notesRow = screen.getByText("Notes").closest("div");
    expect(notesRow?.textContent).toContain("C");
    expect(notesRow?.textContent).toContain("G");
    const tonesRow = screen.getByText("Tones").closest("div");
    expect(tonesRow?.textContent).toContain("7");
  });

  it("reflects a root change in the listed notes", () => {
    renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "G"],
      [scaleNameAtom, "Major"],
    ]);
    const notesRow = screen.getByText("Notes").closest("div");
    // G major contains F# — the seventh scale degree.
    expect(notesRow?.textContent).toContain("F");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<ScaleTheoryFacts />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
