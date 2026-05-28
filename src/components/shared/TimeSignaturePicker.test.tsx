// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { TimeSignaturePicker } from "./TimeSignaturePicker";
import { beatsPerBarAtom, timeSignatureDenominatorAtom } from "../../store/progressionAtoms";

describe("TimeSignaturePicker", () => {
  it("renders the current signature in N/D form", () => {
    const store = makeAtomStore([
      [beatsPerBarAtom, 4],
      [timeSignatureDenominatorAtom, 4],
    ]);
    renderWithStore(<TimeSignaturePicker />, store);
    // LabeledSelect uses Radix UI (not a native <select>), so we query the
    // combobox trigger and check the visible text inside it.
    const trigger = screen.getByRole("combobox", { name: /time signature/i });
    expect(within(trigger).getByText("4/4")).toBeInTheDocument();
  });

  it("emits beats + denominator when the user picks 6/8", async () => {
    const store = makeAtomStore([
      [beatsPerBarAtom, 4],
      [timeSignatureDenominatorAtom, 4],
    ]);
    renderWithStore(<TimeSignaturePicker />, store);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /time signature/i }));
    await user.click(screen.getByRole("option", { name: "6/8" }));
    expect(store.get(beatsPerBarAtom)).toBe(6);
    expect(store.get(timeSignatureDenominatorAtom)).toBe(8);
  });
});
