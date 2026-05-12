// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { TopBandSummary } from "../TopBandSummary/TopBandSummary";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
  practiceLensAtom,
} from "../../store/atoms";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";

describe("TopBandSummary chord integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the practice bar when a chord is active", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    expect(screen.getByRole("group", { name: /Practice cues/i })).toBeTruthy();
  });

  it("renders the scale degree strip alongside the chord bar", () => {
    const { container } = renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    expect(screen.getByRole("group", { name: "Scale degrees" })).toBeTruthy();
    expect(container.querySelector(".chord-practice-bar")).toBeTruthy();
  });

  it("collapses to a single Land on group when the chord is fully in-scale (targets lens)", () => {
    renderWithAtoms(<TopBandSummary />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordRootAtom, "D"],
      [chordTypeAtom, "Minor 7th"],
      [practiceLensAtom, "targets"],
    ]);
    expect(screen.queryByText("Chord:")).toBeNull();
    expect(screen.getByText("Land on:")).toBeTruthy();
  });
});
