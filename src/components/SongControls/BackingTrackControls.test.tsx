// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { progressionDrumPatternAtom, progressionGenreStyleAtom, progressionSwingAtom } from "../../store/progressionAtoms";
import { BackingTrackControls } from "./BackingTrackControls";

describe("BackingTrackControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("renders the backing-track group header and every control", () => {
    renderWithStore(<BackingTrackControls />, makeAtomStore([]));
    expect(screen.getByRole("heading", { name: "Backing Track" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Genre style" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Chord instrument" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Chord pattern" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Bass pattern" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Drum pattern" })).toBeInTheDocument();
    expect(screen.getByLabelText("Swing amount")).toBeInTheDocument();
  });

  it("writes the drum pattern atom when the drum select changes", async () => {
    const store = makeAtomStore([]);
    renderWithStore(<BackingTrackControls />, store);
    const user = userEvent.setup();
    // Default drum pattern is "rock"; pick "Pop" (id="pop") as an alternate
    await user.click(screen.getByRole("combobox", { name: "Drum pattern" }));
    await user.click(screen.getByRole("option", { name: "Pop" }));
    expect(store.get(progressionDrumPatternAtom)).toBe("pop");
  });

  it("writes the swing atom when the swing slider changes", () => {
    const store = makeAtomStore([[progressionSwingAtom, 0]]);
    renderWithStore(<BackingTrackControls />, store);
    fireEvent.change(screen.getByLabelText("Swing amount"), { target: { value: "0.25" } });
    expect(store.get(progressionSwingAtom)).toBeCloseTo(0.25);
  });

  it("reverts the genre selector to custom when an individual control changes", async () => {
    // Seed a real genre so the assertion proves a reversion, not a no-op.
    const store = makeAtomStore([[progressionGenreStyleAtom, "rock"]]);
    renderWithStore(<BackingTrackControls />, store);
    const user = userEvent.setup();
    // Open the Drum pattern LabeledSelect and pick a different option
    await user.click(screen.getByRole("combobox", { name: "Drum pattern" }));
    await user.click(screen.getByRole("option", { name: "Pop" }));
    expect(store.get(progressionGenreStyleAtom)).toBe("custom");
  });
});
