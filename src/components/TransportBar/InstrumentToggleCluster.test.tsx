// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  progressionBassEnabledAtom,
  progressionChordEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionMetronomeEnabledAtom,
} from "../../store/progressionAtoms";
import { axe } from "../../test-utils/a11y";
import { InstrumentToggleCluster } from "./InstrumentToggleCluster";

describe("InstrumentToggleCluster", () => {
  // Several backing-instrument atoms persist via atomWithStorage and default to
  // `true`; clear storage so each test starts from its seeded values.
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the four backing-instrument toggles in a labeled group", () => {
    renderWithStore(<InstrumentToggleCluster />, makeAtomStore([]));
    expect(screen.getByRole("group", { name: "Backing instruments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chord strum" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bassline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drums" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Metronome" })).toBeTruthy();
  });

  it("toggles each backing-instrument atom when its button is clicked", () => {
    const cases = [
      ["Chord strum", progressionChordEnabledAtom],
      ["Bassline", progressionBassEnabledAtom],
      ["Drums", progressionDrumsEnabledAtom],
      ["Metronome", progressionMetronomeEnabledAtom],
    ] as const;

    for (const [label, atom] of cases) {
      localStorage.clear();
      const store = makeAtomStore([[atom, false]]);
      const { unmount } = renderWithStore(<InstrumentToggleCluster />, store);
      const button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(button);
      expect(store.get(atom)).toBe(true);
      unmount();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithStore(<InstrumentToggleCluster />, makeAtomStore([]));
    expect(await axe(container)).toHaveNoViolations();
  });
});
