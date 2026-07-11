import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  progressionStepsAtom,
  activeProgressionStepIndexAtom,
} from "@fretflow/fretboard/store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "@fretflow/fretboard/store/scaleAtoms";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { ChordSuggestions } from "./ChordSuggestions";

function step(id: string, degree: string) {
  return {
    id,
    degree,
    duration: { value: 1, unit: "bar" as const },
    qualityOverride: null,
    manualRoot: null,
  };
}

describe("ChordSuggestions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders function-aware chips for the selected chord", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, [step("a", "I")]],
    ]);
    renderWithStore(<ChordSuggestions disabled={false} />, store);

    expect(screen.getByRole("group", { name: "Suggested next" })).toBeInTheDocument();
    // After I in C major: IV (F), V (G), vi (Am).
    expect(screen.getByTestId("chord-suggestion-IV")).toHaveTextContent("F");
    expect(screen.getByTestId("chord-suggestion-V")).toHaveTextContent("G");
    expect(screen.getByTestId("chord-suggestion-vi")).toHaveTextContent("A");
  });

  it("inserts the clicked candidate after the selected chord and selects it", async () => {
    const user = userEvent.setup();
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, [step("a", "ii"), step("b", "I")]],
    ]);
    store.set(activeProgressionStepIndexAtom, 0);
    renderWithStore(<ChordSuggestions disabled={false} />, store);

    // ii's top suggestion is V (the ii–V move).
    await user.click(screen.getByTestId("chord-suggestion-V"));

    const steps = store.get(progressionStepsAtom);
    expect(steps.map((s) => s.degree)).toEqual(["ii", "V", "I"]);
    expect(steps[1].qualityOverride).toBe("M");
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });

  it("labels chips with the pedagogical reason for screen readers", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, [step("a", "V")]],
    ]);
    renderWithStore(<ChordSuggestions disabled={false} />, store);

    expect(screen.getByTestId("chord-suggestion-I")).toHaveAccessibleName(
      /Authentic cadence/,
    );
  });

  it("disables chips while playback locks the editor", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, [step("a", "I")]],
    ]);
    renderWithStore(<ChordSuggestions disabled />, store);

    expect(screen.getByTestId("chord-suggestion-IV")).toBeDisabled();
  });

  it("renders nothing while the progression is empty", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, []],
    ]);
    renderWithStore(<ChordSuggestions disabled={false} />, store);

    expect(screen.queryByRole("group", { name: "Suggested next" })).not.toBeInTheDocument();
  });
});
