import { describe, it, expect } from "vitest";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { TopBandSummary } from "./TopBandSummary";
import {
  progressionEnabledAtom,
  chordTypeAtom,
} from "../../store/atoms";


describe("TopBandSummary mutual exclusion", () => {
  it("hides the chord-practice bar when progression is enabled", () => {
    const { queryByTestId } = renderWithAtoms(<TopBandSummary />, [
      [progressionEnabledAtom, true],
      // chordTypeAtom being set causes showChordPracticeBarAtom to be true
      [chordTypeAtom, "maj"],
    ]);
    expect(queryByTestId("chord-practice-bar")).toBeNull();
    // Progression status appears
    expect(queryByTestId("progression-status")).toBeTruthy();
  });
});

describe("TopBandSummary progression status row", () => {
  it("uses 'Bar X of N' wording, not 'Step X of N'", () => {
    const { getByText, queryByText } = renderWithAtoms(<TopBandSummary />, [
      [progressionEnabledAtom, true],
    ]);
    expect(getByText(/Bar 1 of \d+/)).toBeTruthy();
    expect(queryByText(/Step 1 of/i)).toBeNull();
  });

  it("renders Current and Next on a single row at desktop widths", () => {
    const { getByText } = renderWithAtoms(<TopBandSummary />, [
      [progressionEnabledAtom, true],
    ]);
    const current = getByText(/Current/i);
    const next = getByText(/Next/i);
    expect(current.closest("[data-progression-status-row]"))
      .toBe(next.closest("[data-progression-status-row]"));
  });
});
