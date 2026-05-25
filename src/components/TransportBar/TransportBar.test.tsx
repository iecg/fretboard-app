// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { beatsPerBarAtom, progressionBassEnabledAtom, progressionChordEnabledAtom, progressionDrumsEnabledAtom, progressionLoopEnabledAtom, progressionMetronomeEnabledAtom, progressionPlayingAtom, progressionStepsAtom, setProgressionPlayingAtom } from "../../store/progressionAtoms";
import { TransportBar } from "./TransportBar";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
] as const;

// A playable progression: enabled, with steps, so playback is not blocked.
const playableAtoms = [
  [progressionStepsAtom, fourStepProgression],
  [beatsPerBarAtom, 4],
] as const;

describe("TransportBar", () => {
  // Several progression atoms persist via atomWithStorage and default to
  // `true`; clear storage so each test starts from its explicitly seeded
  // values rather than another test's persisted state.
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the transport and instrument buttons", () => {
    renderWithAtoms(<TransportBar />, [...playableAtoms]);

    expect(screen.getByRole("button", { name: "Previous chord" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next chord" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Loop progression" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chord strum" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bassline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drums" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Metronome" })).toBeTruthy();
    expect(screen.getByText("Play")).toBeTruthy();
    expect(screen.getByText("Loop")).toBeTruthy();
  });

  it("toggles playback when the play button is clicked", () => {
    // progressionPlayingAtom is a read-only derived atom (defaults to false);
    // it cannot be seeded, so assert the transition from its false default.
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TransportBar />, store);
    expect(store.get(progressionPlayingAtom)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Play progression" }));

    expect(store.get(progressionPlayingAtom)).toBe(true);
  });

  it("disables the transport buttons when playback is blocked", () => {
    // Empty progression steps → playback blocked.
    renderWithAtoms(<TransportBar />, [[progressionStepsAtom, []]]);

    expect(screen.getByRole("button", { name: "Play progression" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous chord" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next chord" })).toBeDisabled();
  });

  it("toggles the loop atom when the loop button is clicked", () => {
    const store = makeAtomStore([...playableAtoms, [progressionLoopEnabledAtom, false]]);
    renderWithStore(<TransportBar />, store);

    fireEvent.click(screen.getByRole("button", { name: "Loop progression" }));

    expect(store.get(progressionLoopEnabledAtom)).toBe(true);
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
      const store = makeAtomStore([...playableAtoms, [atom, false]]);
      const { unmount } = renderWithStore(<TransportBar />, store);
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(store.get(atom)).toBe(true);
      unmount();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<TransportBar />, [...playableAtoms]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("disables prev/next while playing but keeps the pause button enabled", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TransportBar />, store);

    // Seed the playing state via the write atom (requires a playable progression).
    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    expect(screen.getByLabelText(/previous chord/i)).toBeDisabled();
    expect(screen.getByLabelText(/next chord/i)).toBeDisabled();
    // The play/pause button must remain interactive so the user can stop playback.
    expect(screen.getByLabelText(/pause progression/i)).not.toBeDisabled();
  });

  it("no longer renders an inline tempo stepper — tempo moved to the Song tab", () => {
    renderWithAtoms(<TransportBar />, [...playableAtoms]);
    expect(screen.queryByRole("button", { name: /Increase Tempo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Decrease Tempo/ })).toBeNull();
  });
});
