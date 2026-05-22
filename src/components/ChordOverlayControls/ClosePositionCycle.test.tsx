// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithStore, makeAtomStore } from "../../test-utils/renderWithAtoms";
import { ClosePositionCycle } from "./ClosePositionCycle";
import {
  voicingAtom,
  closePositionIndexAtom,
} from "../../store/chordOverlayAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/scaleAtoms";
import type { ProgressionStep } from "../../progressions/progressionDomain";

const STEP_DEFAULTS = {
  duration: { value: 1, unit: "bar" as const },
  qualityOverride: null,
  manualRoot: null,
};
const cMajorOneStep: ProgressionStep[] = [
  { id: "s1", degree: "I", ...STEP_DEFAULTS },
];

describe("ChordOverlayControls/ClosePositionCycle", () => {
  it("shows '0 / 0' and disables both arrows when no candidates", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, []],
      [voicingAtom, "close"],
    ]);
    renderWithStore(<ClosePositionCycle />, store);
    expect(screen.getByTestId("close-cycle-counter")).toHaveTextContent("0 / 0");
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("advances index on next click when candidates are present", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, cMajorOneStep],
      [voicingAtom, "close"],
    ]);
    renderWithStore(<ClosePositionCycle />, store);
    const initial = store.get(closePositionIndexAtom);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(store.get(closePositionIndexAtom)).toBe(initial + 1);
  });

  it("decrements index on previous click when candidates are present", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, cMajorOneStep],
      [voicingAtom, "close"],
      [closePositionIndexAtom, 2],
    ]);
    renderWithStore(<ClosePositionCycle />, store);
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(store.get(closePositionIndexAtom)).toBe(1);
  });

  it("renders a group with the close-cycle aria-label", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, cMajorOneStep],
      [voicingAtom, "close"],
    ]);
    renderWithStore(<ClosePositionCycle />, store);
    expect(
      screen.getByRole("group", { name: /close voicing position/i }),
    ).toBeInTheDocument();
  });

  it("renders the visible 'Position' micro-label", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, cMajorOneStep],
      [voicingAtom, "close"],
    ]);
    const { container } = renderWithStore(<ClosePositionCycle />, store);
    expect(container.querySelector('[class*="section-label"]')).toHaveTextContent("Position");
  });

  it("both buttons carry the control-button class", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, cMajorOneStep],
      [voicingAtom, "close"],
    ]);
    const { container } = renderWithStore(<ClosePositionCycle />, store);
    const buttons = container.querySelectorAll('button[class*="control-button"]');
    expect(buttons).toHaveLength(2);
  });
});
