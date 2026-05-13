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
