// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  voicingStringSetAtom,
} from "../../store/chordOverlayAtoms";
import { progressionStepsAtom } from "../../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../../store/scaleAtoms";
import {
  makeAtomStore,
  renderWithStore,
} from "../../test-utils/renderWithAtoms";
import { ChordStringSetPicker } from "./ChordStringSetPicker";

const C7_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [
    progressionStepsAtom,
    [
      {
        id: "step-1",
        degree: "I",
        duration: { value: 1, unit: "bar" },
        qualityOverride: "Dominant 7th",
        manualRoot: "C",
      },
    ],
  ],
] as const;

describe("ChordStringSetPicker", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a combobox labeled 'Strings'", () => {
    const store = makeAtomStore([...C7_SEEDS] as never);
    renderWithStore(<ChordStringSetPicker />, store);
    expect(
      screen.getByRole("combobox", { name: /strings/i }),
    ).toBeInTheDocument();
  });

  it("offers 'All' + 3 windows for a 4-note chord", async () => {
    const store = makeAtomStore([...C7_SEEDS] as never);
    renderWithStore(<ChordStringSetPicker />, store);
    await userEvent.click(screen.getByRole("combobox", { name: /strings/i }));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "All",
      "1·2·3·4",
      "2·3·4·5",
      "3·4·5·6",
    ]);
  });

  it("writes the option id to voicingStringSetAtom on select", async () => {
    const store = makeAtomStore([...C7_SEEDS] as never);
    renderWithStore(<ChordStringSetPicker />, store);
    await userEvent.click(screen.getByRole("combobox", { name: /strings/i }));
    const options = await screen.findAllByRole("option");
    // Pick the first window option ("1·2·3·4" → id "0-1-2-3")
    await userEvent.click(options[1]!);
    expect(store.get(voicingStringSetAtom)).toBe("0-1-2-3");
  });
});
