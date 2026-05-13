// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import {
  activeProgressionStepIndexAtom,
  progressionEnabledAtom,
  progressionPlayingAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
} from "../../store/atoms";
import { ProgressionPlaybackBar } from "./ProgressionPlaybackBar";

const BASE_SEEDS = [
  [progressionEnabledAtom, true],
  [progressionStepsAtom, [
    { id: "one", degree: "I", duration: "1-bar", qualityOverride: null },
    { id: "two", degree: "V", duration: "1-bar", qualityOverride: null },
  ]],
] as const;

describe("ProgressionPlaybackBar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders transport controls and tempo", () => {
    renderWithStore(<ProgressionPlaybackBar />, makeAtomStore([...BASE_SEEDS]));

    expect(screen.getByRole("button", { name: "Start playback" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous step" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next step" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Tempo (BPM)" })).toHaveValue(90);
  });

  it("toggles play/pause state", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionPlaybackBar />, store);

    await userEvent.click(screen.getByRole("button", { name: "Start playback" }));
    expect(store.get(progressionPlayingAtom)).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Pause playback" }));
    expect(store.get(progressionPlayingAtom)).toBe(false);
  });

  it("navigates steps", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionPlaybackBar />, store);

    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("updates tempo", async () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(<ProgressionPlaybackBar />, store);

    const input = screen.getByRole("spinbutton", { name: "Tempo (BPM)" });
    await userEvent.clear(input);
    await userEvent.type(input, "120");

    expect(store.get(progressionTempoBpmAtom)).toBe(120);
  });

  it("renders nothing when progression is disabled", () => {
    const { container } = renderWithStore(<ProgressionPlaybackBar />, makeAtomStore([
      [progressionEnabledAtom, false],
    ]));
    expect(container).toBeEmptyDOMElement();
  });
});
