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
} from "@fretflow/fretboard/store/progressionAtoms";
import { ShellTransport } from "./ShellTransport";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
] as const;

// A playable progression: enabled, with steps, so playback is not blocked.
const playableAtoms = [
  [progressionStepsAtom, fourStepProgression],
  [beatsPerBarAtom, 4],
] as const;

describe("ShellTransport", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows play button, backing-instrument toggles, and loop toggle", () => {
    renderWithAtoms(<ShellTransport />, [...playableAtoms]);
    expect(screen.getByTestId("shell-play")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Backing instruments" })).toBeInTheDocument();
    expect(screen.getByTestId("shell-loop")).toBeInTheDocument();
  });

  it("no longer renders the scale and tempo chips (moved to track/header)", () => {
    renderWithAtoms(<ShellTransport />, [...playableAtoms]);
    expect(screen.queryByTestId("peek-scale")).not.toBeInTheDocument();
    expect(screen.queryByTestId("peek-tempo")).not.toBeInTheDocument();
  });

  it("toggles loop on tap", async () => {
    const store = makeAtomStore([[progressionLoopEnabledAtom, false]]);
    const { unmount } = renderWithStore(<ShellTransport />, store);
    await userEvent.click(screen.getByTestId("shell-loop"));
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);
    unmount();
  });

  it("toggles a backing instrument from the transport strip", async () => {
    const store = makeAtomStore([[progressionDrumsEnabledAtom, false]]);
    const { unmount } = renderWithStore(<ShellTransport />, store);
    await userEvent.click(screen.getByRole("button", { name: "Drums" }));
    expect(store.get(progressionDrumsEnabledAtom)).toBe(true);
    unmount();
  });

  it("disables the play button when playback is blocked (no steps)", () => {
    renderWithAtoms(<ShellTransport />, [[progressionStepsAtom, []]]);
    expect(screen.getByTestId("shell-play")).toBeDisabled();
  });

  it("shows stop icon while playing", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<ShellTransport />, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    // When playing, the play button should have aria-label containing "Stop"
    const playBtn = screen.getByTestId("shell-play");
    expect(playBtn.getAttribute("aria-label")).toMatch(/stop/i);
  });

  it("starts playback on play click", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<ShellTransport />, store);

    expect(store.get(progressionPlayingAtom)).toBe(false);
    act(() => {
      screen.getByTestId("shell-play").click();
    });
    expect(store.get(progressionPlayingAtom)).toBe(true);
  });

  it("shows loop toggle with aria-pressed reflecting loop state", () => {
    const store = makeAtomStore([[progressionLoopEnabledAtom, true]]);
    renderWithStore(<ShellTransport />, store);
    expect(screen.getByTestId("shell-loop")).toHaveAttribute("aria-pressed", "true");
  });

  it("opts the row into the sheet touch-target guard", () => {
    renderWithAtoms(<ShellTransport />, [...playableAtoms]);
    expect(screen.getByTestId("shell-transport")).toHaveAttribute("data-placement", "sheet");
  });
});
