// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { TheoryControls } from "./TheoryControls";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  chordTypeAtom,
  viewModeAtom,
  focusPresetAtom,
} from "../store/atoms";

function renderWithStore(ui: React.ReactElement, store = createStore()) {
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

describe("TheoryControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders root, family, and browse controls with chord overlay collapsed", () => {
    renderWithStore(<TheoryControls />);

    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Scale Family" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parallel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Previous Mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Next Mode/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Mode" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Chord Overlay/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chord Type")).not.toBeInTheDocument();
  });

  it("switches families using the scale family select", () => {
    const { store } = renderWithStore(<TheoryControls />);

    fireEvent.change(screen.getByRole("combobox", { name: "Scale Family" }), {
      target: { value: "Pentatonic" },
    });

    expect(store.get(scaleNameAtom)).toBe("Minor Pentatonic");
  });

  it("switches the active mode using the browse select in parallel mode", () => {
    const { store } = renderWithStore(<TheoryControls />);

    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), {
      target: { value: "C Dorian" },
    });

    expect(store.get(scaleNameAtom)).toBe("Dorian");
    expect(store.get(rootNoteAtom)).toBe("C");
  });

  it("switches root and mode together when relative browsing is active", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(scaleBrowseModeAtom, "relative");

    renderWithStore(<TheoryControls />, store);

    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), {
      target: { value: "D Dorian (2nd Mode)" },
    });

    expect(store.get(rootNoteAtom)).toBe("D");
    expect(store.get(scaleNameAtom)).toBe("Dorian");
  });

  it("hides the browse-mode toggle for variant families", () => {
    const store = createStore();
    store.set(scaleNameAtom, "Minor Pentatonic");
    store.set(scaleBrowseModeAtom, "relative");

    renderWithStore(<TheoryControls />, store);

    expect(
      screen.queryByRole("button", { name: "Parallel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Variant" }),
    ).toBeInTheDocument();
  });

  it("expands the chord overlay controls on demand", () => {
    renderWithStore(<TheoryControls />);

    fireEvent.click(screen.getByRole("button", { name: /Chord Overlay/i }));

    expect(screen.getByText("Chord Type")).toBeInTheDocument();
  });

  it("shows the inline key explorer only after disclosure is opened", () => {
    renderWithStore(<TheoryControls keyExplorer={<div>Key Wheel</div>} />);

    expect(screen.queryByText("Key Wheel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Circle of Fifths/i }));
    expect(screen.getByText("Key Wheel")).toBeInTheDocument();
  });

  it("shows View and Focus controls when a chord type is selected", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.getByText("Focus")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Scale + Chord" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Chord Only" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rootless" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("calls setViewMode when a view option is clicked", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    fireEvent.click(screen.getByRole("button", { name: "Chord Only" }));
    expect(store.get(viewModeAtom)).toBe("chord");
  });

  it("calls setFocusPreset when a focus option is clicked", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    fireEvent.click(screen.getByRole("button", { name: "Rootless" }));
    expect(store.get(focusPresetAtom)).toBe("rootless");
  });

  it("shows custom member toggles when focusPreset is custom", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");
    store.set(focusPresetAtom, "custom");

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Root" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
  });

  it("Outside view option is disabled when hasOutsideChordMembers is false", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByRole("button", { name: "Outside" })).toBeDisabled();
  });

  it("Outside view option is enabled when hasOutsideChordMembers is true", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordTypeAtom, "Major 7th"); // This will have outside members if scale is major pentatonic? 
    // No, Major 7th (C E G B) is in C Major (C D E F G A B).
    // Let's use a chord that is definitely outside.
    // Major 7th against Minor Pentatonic.
    store.set(scaleNameAtom, "Minor Pentatonic"); // C Eb F G Bb
    store.set(chordTypeAtom, "Major Triad"); // C E G -> E is outside.

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByRole("button", { name: "Outside" })).not.toBeDisabled();
  });
});
