// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  progressionTempoBpmAtom,
  progressionLoopEnabledAtom,
  progressionStepsAtom,
  beatsPerBarAtom,
  setProgressionPlayingAtom,
  progressionPlayingAtom,
} from "../../store/progressionAtoms";
import { SheetPeekTransport } from "./SheetPeekTransport";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
] as const;

// A playable progression: enabled, with steps, so playback is not blocked.
const playableAtoms = [
  [progressionStepsAtom, fourStepProgression],
  [beatsPerBarAtom, 4],
] as const;

describe("SheetPeekTransport", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows play button, tempo, scale, and loop toggle", () => {
    renderWithAtoms(<SheetPeekTransport />, [
      ...playableAtoms,
      [progressionTempoBpmAtom, 90],
    ]);
    expect(screen.getByTestId("peek-play")).toBeInTheDocument();
    expect(screen.getByTestId("peek-tempo")).toHaveTextContent("90");
    expect(screen.getByTestId("peek-scale")).toBeInTheDocument();
    expect(screen.getByTestId("peek-loop")).toBeInTheDocument();
  });

  it("toggles loop on tap", async () => {
    const store = makeAtomStore([[progressionLoopEnabledAtom, false]]);
    const { unmount } = renderWithStore(<SheetPeekTransport />, store);
    await userEvent.click(screen.getByTestId("peek-loop"));
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);
    unmount();
  });

  it("disables the play button when playback is blocked (no steps)", () => {
    renderWithAtoms(<SheetPeekTransport />, [[progressionStepsAtom, []]]);
    expect(screen.getByTestId("peek-play")).toBeDisabled();
  });

  it("shows stop icon while playing", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<SheetPeekTransport />, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    // When playing, the play button should have aria-label containing "Stop"
    const playBtn = screen.getByTestId("peek-play");
    expect(playBtn.getAttribute("aria-label")).toMatch(/stop/i);
  });

  it("starts playback on play click", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<SheetPeekTransport />, store);

    expect(store.get(progressionPlayingAtom)).toBe(false);
    act(() => {
      screen.getByTestId("peek-play").click();
    });
    expect(store.get(progressionPlayingAtom)).toBe(true);
  });

  it("shows loop chip with aria-pressed reflecting loop state", () => {
    const store = makeAtomStore([[progressionLoopEnabledAtom, true]]);
    renderWithStore(<SheetPeekTransport />, store);
    expect(screen.getByTestId("peek-loop")).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the tempo value in the tempo chip", () => {
    renderWithAtoms(<SheetPeekTransport />, [
      ...playableAtoms,
      [progressionTempoBpmAtom, 120],
    ]);
    expect(screen.getByTestId("peek-tempo")).toHaveTextContent("120");
  });
});
