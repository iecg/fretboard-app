// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { TheoryControls, TheorySection } from "../TheoryControls/TheoryControls";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  chordTypeAtom,
  practiceLensAtom,
} from "../../store/atoms";
import { axe } from "../../test-utils/a11y";

function renderWithStore(ui: React.ReactElement, store = createStore()) {
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

describe("TheoryControls/TheoryControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders scale controls with chords collapsed", () => {
    renderWithStore(<TheoryControls />);

    expect(
      screen.getByRole("button", { name: /Scale.*C Major/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Scale Family" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Browse scale families" }),
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
      screen.getByRole("button", { name: /Chords.*Off/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chord Type")).not.toBeInTheDocument();
  });

  it("renders with scale browse mode initial state", () => {
    const store = createStore();

    renderWithStore(<TheoryControls />, store);

    expect(store.get(scaleBrowseModeAtom)).toBe("parallel");
  });

  it("expands the chord controls on demand", () => {
    renderWithStore(<TheoryControls />);

    fireEvent.click(screen.getByRole("button", { name: /Chords/i }));

    expect(screen.getByRole("group", { name: "Chord overlay mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Degree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manual" })).toBeInTheDocument();
  });

  it("shows the inline key explorer only after disclosure is opened", () => {
    renderWithStore(<TheoryControls keyExplorer={<div>Key Wheel</div>} />);

    expect(screen.queryByText("Key Wheel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Circle of Fifths/i }));
    expect(screen.getByText("Key Wheel")).toBeInTheDocument();
  });

  it("shows Lens controls when a chord type is selected (no Focus section)", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByText("Lens")).toBeInTheDocument();
    expect(screen.queryByText("Focus")).not.toBeInTheDocument();
    // Chord + Color and Color Notes lenses are removed from the chord overlay
    expect(screen.queryByRole("button", { name: "Chord + Color" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Color Notes" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Chord Tones" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guide Tones" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
  });

  it("calls setPracticeLens when a lens option is clicked", () => {
    const store = createStore();
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    fireEvent.click(screen.getByRole("button", { name: "Chord Tones" }));
    expect(store.get(practiceLensAtom)).toBe("targets");
  });

  it("Tension lens is hidden when chord is fully in-scale", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Major");
    store.set(chordTypeAtom, "Major Triad");

    renderWithStore(<TheoryControls />, store);

    // Tension is hidden (not just disabled) when unavailable
    expect(screen.queryByRole("button", { name: "Tension" })).not.toBeInTheDocument();
  });

  it("Tension lens option is shown and enabled when chord has outside tones", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "Minor Pentatonic"); // C Eb F G Bb
    store.set(chordTypeAtom, "Major Triad"); // C E G -> E is outside.

    renderWithStore(<TheoryControls />, store);

    expect(screen.getByRole("button", { name: "Tension" })).not.toBeDisabled();
  });

  it("compact prop is not set by default", () => {
    renderWithStore(<TheoryControls />);

    const sections = document.querySelectorAll("[data-compact]");
    expect(sections).toHaveLength(0);
  });

  it("compact prop sets data-compact on theory sections", () => {
    renderWithStore(<TheoryControls compact />);

    // Both TheorySection elements must have data-compact="true".
    // Additional child elements (NoteGrid, ToggleBar, etc.) may also carry it.
    const theorySections = document.querySelectorAll(
      'section[data-compact="true"]',
    );
    expect(theorySections.length).toBeGreaterThanOrEqual(2);
  });
});

describe("TheoryControls/TheorySection", () => {
  it("does not render data-compact attribute by default", async () => {
    const { container } = render(
      <TheorySection title="Scale" summary="C Major">
        <div>content</div>
      </TheorySection>,
    );
    const section = container.querySelector("section");
    expect(section).not.toHaveAttribute("data-compact");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders data-compact='true' when compact prop is set", async () => {
    const { container } = render(
      <TheorySection title="Scale" summary="C Major" compact>
        <div>content</div>
      </TheorySection>,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-compact", "true");
    expect(await axe(container)).toHaveNoViolations();
  });
});
