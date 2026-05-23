// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chordSnapToScaleAtom } from "../../store/chordOverlayAtoms";
import {
  makeAtomStore,
  renderWithStore,
} from "../../test-utils/renderWithAtoms";
import { ChordSnapToScaleToggle } from "./ChordSnapToScaleToggle";

describe("ChordSnapToScaleToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a switch reflecting the atom (default true)", () => {
    const store = makeAtomStore();
    renderWithStore(<ChordSnapToScaleToggle />, store);
    const sw = screen.getByRole("switch", { name: /lock to scale/i });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("flips the atom on click", async () => {
    const store = makeAtomStore();
    renderWithStore(<ChordSnapToScaleToggle />, store);
    expect(store.get(chordSnapToScaleAtom)).toBe(true);
    await userEvent.click(
      screen.getByRole("switch", { name: /lock to scale/i }),
    );
    expect(store.get(chordSnapToScaleAtom)).toBe(false);
  });
});
