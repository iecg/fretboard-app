// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, fireEvent } from "@testing-library/react";
import { axe } from "../../test-utils/a11y";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  activeProgressionStepIndexAtom,
  fingeringPatternAtom,
  progressionEnabledAtom,
  progressionLoopEnabledAtom,
  progressionPlayingAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  rootNoteAtom,
  scaleNameAtom,
} from "../../store/atoms";
import { ProgressionPlaybackBar } from "./ProgressionPlaybackBar";

const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [progressionEnabledAtom, true],
  [progressionTempoBpmAtom, 120],
  [progressionStepsAtom, [
    { id: "one", degree: "I", duration: "1-beat", qualityOverride: null },
    { id: "two", degree: "V", duration: "1-beat", qualityOverride: null },
  ]],
] as const;

describe("ProgressionPlaybackBar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders active step, next step, tempo, loop, and transport controls", () => {
    renderWithStore(<ProgressionPlaybackBar />, makeAtomStore([...BASE_SEEDS]));

    expect(screen.getByRole("group", { name: "Progression playback" })).toBeInTheDocument();
    expect(screen.getByText("I")).toBeInTheDocument();
    expect(screen.getByText("C Major Triad")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Progression tempo" })).toHaveValue(120);
    expect(screen.getByRole("button", { name: "Loop progression" })).toHaveAttribute("aria-pressed", "true");
  });

  describe("Playback with fake timers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("advances automatically while playing", () => {
      const store = makeAtomStore([...BASE_SEEDS]);
      renderWithStore(<ProgressionPlaybackBar />, store);

      fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
      expect(store.get(progressionPlayingAtom)).toBe(true);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
    });

    it("stops at the final step when loop is off", () => {
      const store = makeAtomStore([
        ...BASE_SEEDS,
        [progressionLoopEnabledAtom, false],
        [activeProgressionStepIndexAtom, 1],
      ]);
      renderWithStore(<ProgressionPlaybackBar />, store);

      fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
      expect(store.get(progressionPlayingAtom)).toBe(false);
    });
  });

  it("shows the disabled reason and prevents playback for one-string patterns", () => {
    const store = makeAtomStore([
      ...BASE_SEEDS,
      [fingeringPatternAtom, "one-string"],
    ]);
    renderWithStore(<ProgressionPlaybackBar />, store);

    expect(screen.getByText("Chord overlay disabled for single/two-string patterns.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeDisabled();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithStore(<ProgressionPlaybackBar />, makeAtomStore([...BASE_SEEDS]));
    expect(await axe(container)).toHaveNoViolations();
  });
});
