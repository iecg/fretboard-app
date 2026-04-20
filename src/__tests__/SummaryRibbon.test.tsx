// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { SummaryRibbon } from "../components/SummaryRibbon";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
  scaleVisibleAtom,
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
    expect(screen.queryByRole("group", { name: /Practice cues/i })).not.toBeInTheDocument();
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
    expect(screen.getByRole("group", { name: /Practice cues/i })).toBeInTheDocument();
  });

  describe("eye toggle scale visibility", () => {
    it("renders eye toggle button", () => {
      renderWithAtoms(<SummaryRibbon />, [...BASE_SEEDS]);
      const eyeButton = screen.getByRole("button", { name: /hide scale|show scale/i });
      expect(eyeButton).toBeInTheDocument();
    });

    it("eye on (default) shows chip list with 7 chips for C Major", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibleAtom, true],
      ]);
      expect(screen.getAllByRole("listitem").length).toBe(7);
    });

    it("eye off hides the chip list", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibleAtom, false],
      ]);
      expect(screen.queryAllByRole("listitem").length).toBe(0);
    });

    it("eye off still shows the scale degrees group (for eye control)", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibleAtom, false],
      ]);
      expect(screen.getByRole("group", { name: "Scale degrees" })).toBeInTheDocument();
    });

    it("eye on shows chip toggle buttons as enabled", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibleAtom, true],
      ]);
      // Chips are enabled when scale is visible (onChipToggle is always passed)
      const hideButtons = screen.getAllByRole("button", { name: /Hide|Show/ });
      expect(hideButtons.every((b) => !b.hasAttribute("disabled"))).toBe(true);
    });

    it("chord overlay does not change scale-strip semantics", () => {
      renderWithAtoms(<SummaryRibbon />, [
        [rootNoteAtom, "C"],
        [scaleNameAtom, "Major"],
        [chordRootAtom, "C"],
        [chordTypeAtom, "Major Triad"],
        [scaleVisibleAtom, true],
      ]);
      // Scale strip still shows all 7 scale chips regardless of chord overlay
      expect(screen.getAllByRole("listitem").length).toBe(7);
      // No chord-specific attributes on scale strip
      const scaleGroup = screen.getByRole("group", { name: "Scale degrees" });
      expect(scaleGroup.getAttribute("data-chord-active")).toBeNull();
      expect(scaleGroup.getAttribute("data-in-chord")).toBeNull();
    });
  });
});
