// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  progressionDrumPatternAtom,
  progressionGenreStyleAtom,
  progressionSwingAtom,
} from "../../store/atoms";
import { BackingTrackControls } from "./BackingTrackControls";

describe("BackingTrackControls", () => {
  it("renders the backing-track group header and every control", () => {
    renderWithStore(<BackingTrackControls />, makeAtomStore([]));
    expect(screen.getByRole("heading", { name: "Backing Track" })).toBeInTheDocument();
    expect(screen.getByLabelText("Genre style")).toBeInTheDocument();
    expect(screen.getByLabelText("Chord instrument")).toBeInTheDocument();
    expect(screen.getByLabelText("Chord pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Bass pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Drum pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Swing amount")).toBeInTheDocument();
  });

  it("writes the drum pattern atom when the drum select changes", () => {
    const store = makeAtomStore([]);
    renderWithStore(<BackingTrackControls />, store);
    const select = screen.getByLabelText("Drum pattern") as HTMLSelectElement;
    const next = Array.from(select.options).map((o) => o.value).find((v) => v !== select.value);
    expect(next).toBeDefined();
    fireEvent.change(select, { target: { value: next } });
    expect(store.get(progressionDrumPatternAtom)).toBe(next);
  });

  it("writes the swing atom when the swing slider changes", () => {
    const store = makeAtomStore([[progressionSwingAtom, 0]]);
    renderWithStore(<BackingTrackControls />, store);
    fireEvent.change(screen.getByLabelText("Swing amount"), { target: { value: "0.25" } });
    expect(store.get(progressionSwingAtom)).toBeCloseTo(0.25);
  });

  it("reverts the genre selector to custom when an individual control changes", () => {
    // Seed a real genre so the assertion proves a reversion, not a no-op.
    const store = makeAtomStore([[progressionGenreStyleAtom, "rock"]]);
    renderWithStore(<BackingTrackControls />, store);
    const select = screen.getByLabelText("Drum pattern") as HTMLSelectElement;
    const next = Array.from(select.options).map((o) => o.value).find((v) => v !== select.value);
    fireEvent.change(select, { target: { value: next } });
    expect(store.get(progressionGenreStyleAtom)).toBe("custom");
  });
});
