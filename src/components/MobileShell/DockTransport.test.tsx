// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  progressionLoopEnabledAtom,
  progressionStepsAtom,
  progressionDrumsEnabledAtom,
  beatsPerBarAtom,
  setProgressionPlayingAtom,
  progressionPlayingAtom,
} from "../../store/progressionAtoms";
import { DockTransport } from "./DockTransport";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
] as const;

// A playable progression: enabled, with steps, so playback is not blocked.
const playableAtoms = [
  [progressionStepsAtom, fourStepProgression],
  [beatsPerBarAtom, 4],
] as const;

describe("DockTransport", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows play button, backing-instrument toggles, and loop toggle", () => {
    renderWithAtoms(<DockTransport />, [...playableAtoms]);
    expect(screen.getByTestId("dock-play")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Backing instruments" })).toBeInTheDocument();
    expect(screen.getByTestId("dock-loop")).toBeInTheDocument();
  });

  it("no longer renders the scale and tempo chips (moved to track/header)", () => {
    renderWithAtoms(<DockTransport />, [...playableAtoms]);
    expect(screen.queryByTestId("peek-scale")).not.toBeInTheDocument();
    expect(screen.queryByTestId("peek-tempo")).not.toBeInTheDocument();
  });

  it("toggles loop on tap", async () => {
    const store = makeAtomStore([[progressionLoopEnabledAtom, false]]);
    const { unmount } = renderWithStore(<DockTransport />, store);
    await userEvent.click(screen.getByTestId("dock-loop"));
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);
    unmount();
  });

  it("toggles a backing instrument from the dock row", async () => {
    const store = makeAtomStore([[progressionDrumsEnabledAtom, false]]);
    const { unmount } = renderWithStore(<DockTransport />, store);
    await userEvent.click(screen.getByRole("button", { name: "Drums" }));
    expect(store.get(progressionDrumsEnabledAtom)).toBe(true);
    unmount();
  });

  it("disables the play button when playback is blocked (no steps)", () => {
    renderWithAtoms(<DockTransport />, [[progressionStepsAtom, []]]);
    expect(screen.getByTestId("dock-play")).toBeDisabled();
  });

  it("shows stop icon while playing", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<DockTransport />, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    // When playing, the play button should have aria-label containing "Stop"
    const playBtn = screen.getByTestId("dock-play");
    expect(playBtn.getAttribute("aria-label")).toMatch(/stop/i);
  });

  it("starts playback on play click", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<DockTransport />, store);

    expect(store.get(progressionPlayingAtom)).toBe(false);
    act(() => {
      screen.getByTestId("dock-play").click();
    });
    expect(store.get(progressionPlayingAtom)).toBe(true);
  });

  it("shows loop toggle with aria-pressed reflecting loop state", () => {
    const store = makeAtomStore([[progressionLoopEnabledAtom, true]]);
    renderWithStore(<DockTransport />, store);
    expect(screen.getByTestId("dock-loop")).toHaveAttribute("aria-pressed", "true");
  });

  it("opts the row into the sheet touch-target guard", () => {
    renderWithAtoms(<DockTransport />, [...playableAtoms]);
    expect(screen.getByTestId("dock-transport")).toHaveAttribute("data-placement", "sheet");
  });
});
