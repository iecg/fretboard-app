// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { progressionDrumPatternAtom, progressionGenreStyleAtom } from "@fretflow/fretboard/store/progressionAtoms";
import { BackingTrackControls } from "./BackingTrackControls";

describe("BackingTrackControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the backing-track group header and only the genre control", () => {
    renderWithStore(<BackingTrackControls />, makeAtomStore([]));
    expect(screen.getByRole("heading", { name: "Backing Track" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Genre style" })).toBeInTheDocument();
    // Patterns + swing are bundled into the genre preset, not individual knobs.
    expect(screen.queryByRole("combobox", { name: "Chord pattern" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Bass pattern" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Drum pattern" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Swing amount")).not.toBeInTheDocument();
  });

  it("applies the genre's bundled settings when the genre changes", async () => {
    const store = makeAtomStore([]);
    renderWithStore(<BackingTrackControls />, store);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Genre style" }));
    await user.click(screen.getByRole("option", { name: "Blues" }));
    expect(store.get(progressionGenreStyleAtom)).toBe("blues");
    expect(store.get(progressionDrumPatternAtom)).toBe("blues-shuffle");
  });

  it("shows a display-only Custom option when the persisted genre is custom", () => {
    const store = makeAtomStore([[progressionGenreStyleAtom, "custom"]]);
    renderWithStore(<BackingTrackControls />, store);
    expect(screen.getByRole("combobox", { name: "Genre style" })).toHaveTextContent("Custom");
  });
});
