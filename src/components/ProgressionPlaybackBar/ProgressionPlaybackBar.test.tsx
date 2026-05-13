// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { ProgressionPlaybackBar } from "./ProgressionPlaybackBar";
import { progressionEnabledAtom, progressionTempoBpmAtom } from "../../store/atoms";

describe("ProgressionPlaybackBar", () => {
  it("renders nothing when progression is disabled", () => {
    const { container } = renderWithAtoms(<ProgressionPlaybackBar />, [
      [progressionEnabledAtom, false],
    ]);
    expect(container.firstChild).toBeNull();
  });

  it("does not render any chord name or upcoming chip", () => {
    const { queryByText } = renderWithAtoms(<ProgressionPlaybackBar />, [
      [progressionEnabledAtom, true],
    ]);
    expect(queryByText(/Major Triad/i)).toBeNull();
    expect(queryByText(/Dominant 7th/i)).toBeNull();
  });

  it("uses a stepper for tempo, not a bare input[type=number]", () => {
    const { queryByLabelText, getByLabelText } = renderWithAtoms(<ProgressionPlaybackBar />, [
      [progressionEnabledAtom, true],
      [progressionTempoBpmAtom, 100],
    ]);
    expect(queryByLabelText("Progression tempo")).toBeNull(); // old bare input label
    expect(getByLabelText(/Increase Tempo/i)).toBeTruthy(); // stepper button
  });
});
