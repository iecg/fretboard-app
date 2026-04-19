// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { SummaryRibbon } from "../components/SummaryRibbon";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
  scaleVisibilityModeAtom,
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

  describe("scale visibility mode control", () => {
    it("renders visibility toggle group with All/Custom/Off options", () => {
      renderWithAtoms(<SummaryRibbon />, [...BASE_SEEDS]);
      const group = screen.getByRole("group", { name: "Scale visibility" });
      expect(group).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Off" })).toBeInTheDocument();
    });

    it("mode 'all' shows chip list (default)", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibilityModeAtom, "all"],
      ]);
      // 7 chips for C Major
      expect(screen.getAllByRole("listitem").length).toBe(7);
    });

    it("mode 'custom' shows chip list with toggleable chips", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibilityModeAtom, "custom"],
      ]);
      expect(screen.getAllByRole("listitem").length).toBe(7);
      // Chips should be enabled (custom mode passes onChipToggle)
      const hideButtons = screen.getAllByRole("button", { name: /Hide|Show/ });
      expect(hideButtons.every((b) => !b.hasAttribute("disabled"))).toBe(true);
    });

    it("mode 'off' hides the chip list", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibilityModeAtom, "off"],
      ]);
      expect(screen.queryAllByRole("listitem").length).toBe(0);
    });

    it("mode 'off' still shows the scale degrees group (for visibility control)", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibilityModeAtom, "off"],
      ]);
      expect(screen.getByRole("group", { name: "Scale degrees" })).toBeInTheDocument();
    });

    it("mode 'all' disables chip toggle buttons", () => {
      renderWithAtoms(<SummaryRibbon />, [
        ...BASE_SEEDS,
        [scaleVisibilityModeAtom, "all"],
      ]);
      const chipButtons = screen.getAllByRole("button", { name: /Hide|Show/ });
      expect(chipButtons.every((b) => b.hasAttribute("disabled"))).toBe(true);
    });
  });
});
