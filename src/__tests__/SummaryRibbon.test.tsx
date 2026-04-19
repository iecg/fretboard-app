// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { SummaryRibbon } from "../components/SummaryRibbon";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
} from "../store/atoms";
import { renderWithAtoms } from "./utils/renderWithAtoms";

const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [chordTypeAtom, null],
  [chordRootAtom, "C"],
] as const;

describe("SummaryRibbon", () => {
  it("renders DegreeChipStrip without ChordPracticeBar when chordType is null", () => {
    renderWithAtoms(<SummaryRibbon />, [...BASE_SEEDS]);
    expect(screen.getByRole("group", { name: "Scale degrees" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Chord analysis/i })).not.toBeInTheDocument();
  });

  it("renders both DegreeChipStrip and ChordPracticeBar when chordType is set and non-diatonic", () => {
    renderWithAtoms(<SummaryRibbon />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      // F# is outside C Major — triggers hasOutsideChordMembers, so showChordPracticeBar = true
      [chordRootAtom, "F#"],
      [chordTypeAtom, "Major Triad"],
    ]);
    expect(screen.getByRole("group", { name: "Scale degrees" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Chord analysis/i })).toBeInTheDocument();
  });
});
