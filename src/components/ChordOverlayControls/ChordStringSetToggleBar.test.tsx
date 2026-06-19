// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type CagedShape } from "@fretflow/core";
import { makeAtomStore, renderWithAtoms, renderWithStore } from "../../test-utils/renderWithAtoms";
import { ChordStringSetToggleBar } from "./ChordStringSetToggleBar";
import {
  voicingAtom,
  voicingStringSetAtom,
} from "@fretflow/fretboard/store/chordOverlayAtoms";
import { cagedShapesAtom, fingeringPatternAtom } from "@fretflow/fretboard/store/fingeringAtoms";
import { rootNoteAtom, scaleNameAtom } from "@fretflow/fretboard/store/scaleAtoms";
import { progressionStepsAtom } from "@fretflow/fretboard/store/progressionAtoms";

type ProgressionStepSeed = {
  id: string;
  degree: "I";
  duration: { value: 1; unit: "bar" };
  qualityOverride: string | null;
  manualRoot: string | null;
};

function makeStep(qualityOverride: string | null = null, manualRoot: string | null = null): ProgressionStepSeed[] {
  return [{ id: "step-1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride, manualRoot }];
}

describe("ChordStringSetToggleBar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders one button per consecutive-string window for a major triad", () => {
    renderWithAtoms(<ChordStringSetToggleBar />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, makeStep("M", "C")],
      [voicingAtom, "close"],
      [voicingStringSetAtom, "0-1-2"],
    ] as never);
    // C major triad = 3 voices → 4 windows: 0-1-2, 1-2-3, 2-3-4, 3-4-5
    expect(screen.getByRole("button", { name: "1·2·3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2·3·4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3·4·5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4·5·6" })).toBeInTheDocument();
  });

  it("does not render an 'All' button", () => {
    renderWithAtoms(<ChordStringSetToggleBar />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, makeStep("M", "C")],
      [voicingAtom, "close"],
      [voicingStringSetAtom, "0-1-2"],
    ] as never);
    expect(screen.queryByRole("button", { name: /^All$/i })).not.toBeInTheDocument();
  });

  it("marks the active window button with aria-pressed=true", () => {
    renderWithAtoms(<ChordStringSetToggleBar />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, makeStep("M", "C")],
      [voicingAtom, "close"],
      [voicingStringSetAtom, "0-1-2"],
    ] as never);
    expect(screen.getByRole("button", { name: "1·2·3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "2·3·4" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setValue with the option id on click", async () => {
    const user = userEvent.setup();
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, makeStep("M", "C")],
      [voicingAtom, "close"],
      [voicingStringSetAtom, "0-1-2"],
    ] as never);
    renderWithStore(<ChordStringSetToggleBar />, store);
    await user.click(screen.getByRole("button", { name: "2·3·4" }));
    expect(store.get(voicingStringSetAtom)).toBe("1-2-3");
  });

  it("renders disabled buttons with aria-disabled and disabledReason as title", () => {
    // C dim / C major / G shape: all close-voicing windows are disabled.
    renderWithAtoms(<ChordStringSetToggleBar />, [
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, makeStep("dim", "C")],
      [fingeringPatternAtom, "caged"],
      [cagedShapesAtom, new Set<CagedShape>(["G"])],
      [voicingAtom, "close"],
    ] as never);
    const disabledButton = screen.getByRole("button", { name: "1·2·3" });
    expect(disabledButton).toBeDisabled();
    expect(disabledButton).toHaveAttribute("title");
  });

  it("renders nothing when no chord is active (no options)", () => {
    renderWithAtoms(<ChordStringSetToggleBar />, [
      [progressionStepsAtom, []],
      [voicingAtom, "close"],
    ] as never);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
