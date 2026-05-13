// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { chordTypeAtom, progressionEnabledAtom } from "../../store/atoms";
import { ProgressionSummarySlot } from "./ProgressionSummarySlot";

describe("ProgressionSummarySlot", () => {
  it("renders the progression track instead of the top band summary when progression is enabled", () => {
    renderWithAtoms(<ProgressionSummarySlot />, [
      [progressionEnabledAtom, true],
      [chordTypeAtom, "Major Triad"],
    ]);

    expect(screen.getByRole("group", { name: "Progression track" })).toBeTruthy();
    expect(screen.queryByTestId("top-band-summary")).toBeNull();
    expect(screen.queryByTestId("chord-practice-bar")).toBeNull();
  });

  it("renders the existing top band summary when progression is disabled", () => {
    renderWithAtoms(<ProgressionSummarySlot />, [
      [progressionEnabledAtom, false],
      [chordTypeAtom, "Major Triad"],
    ]);

    expect(screen.getByTestId("top-band-summary")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Progression track" })).toBeNull();
  });
});
