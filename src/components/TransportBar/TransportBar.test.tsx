// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import React from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import {
  activeProgressionStepIndexAtom,
  beatsPerBarAtom,
  progressionBassEnabledAtom,
  progressionChordEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionLoopEnabledAtom,
  progressionMetronomeEnabledAtom,
  progressionPlaybackLoadingAtom,
  progressionPlayingAtom,
  progressionStepsAtom,
  setProgressionPlayingAtom,
} from "../../store/progressionAtoms";
import { languageAtom } from "../../store/languageAtom";
import { TooltipProvider } from "../Tooltip/Tooltip";
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
    renderWithAtoms(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>,[...playableAtoms]);

    expect(screen.queryByRole("button", { name: "Previous chord" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next chord" })).toBeNull();
    expect(screen.getByRole("button", { name: "Loop progression" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop progression" })).toBeNull();
    expect(screen.queryByLabelText(/pause progression/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Chord strum" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bassline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drums" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Metronome" })).toBeTruthy();
    expect(screen.getByText("Play")).toBeTruthy();
    expect(screen.getByText("Loop")).toBeTruthy();
  });

  it("uses translated play labels when the language changes", () => {
    renderWithAtoms(
      <TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>,
      [...playableAtoms, [languageAtom, "es"]],
    );

    expect(screen.getByRole("button", { name: "Reproducir progresión" })).toBeTruthy();
  });

  it("uses translated stop labels when the language changes", () => {
    const store = makeAtomStore([...playableAtoms, [languageAtom, "es"]]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    expect(screen.getByRole("button", { name: "Detener progresión" })).toBeTruthy();
  });

  it("toggles playback when the play button is clicked", () => {
    // progressionPlayingAtom is a read-only derived atom (defaults to false);
    // it cannot be seeded, so assert the transition from its false default.
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);
    expect(store.get(progressionPlayingAtom)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Play progression" }));

    expect(store.get(progressionPlayingAtom)).toBe(true);
  });

  it("disables the transport buttons when playback is blocked", () => {
    // Empty progression steps → playback blocked.
    renderWithAtoms(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>,[[progressionStepsAtom, []]]);

    expect(screen.getByRole("button", { name: "Play progression" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Stop progression" })).toBeNull();
  });

  it("toggles the loop atom when the loop button is clicked", () => {
    const store = makeAtomStore([...playableAtoms, [progressionLoopEnabledAtom, false]]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

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
      const { unmount } = renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(store.get(atom)).toBe(true);
      unmount();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithAtoms(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>,[...playableAtoms]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps the stop button enabled while playing", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    // Seed the playing state via the write atom (requires a playable progression).
    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    expect(screen.getByRole("button", { name: "Stop progression" })).toBeEnabled();
    expect(screen.queryByLabelText(/pause progression/i)).toBeNull();
  });

  it("labels the play/stop button as Stop progression while playing", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    expect(screen.getByRole("button", { name: "Stop progression" })).toBeInTheDocument();
  });

  it("keeps the stop label enabled when playback becomes blocked mid-run", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    act(() => {
      store.set(progressionStepsAtom, []);
    });

    expect(screen.getByRole("button", { name: "Stop progression" })).toBeEnabled();
  });

  it("keeps the loop toggle enabled while playing (transparent live update)", () => {
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    expect(screen.getByLabelText(/loop progression/i)).toBeEnabled();
  });

  it("no longer renders an inline tempo stepper — tempo moved to the Song tab", () => {
    renderWithAtoms(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>,[...playableAtoms]);
    expect(screen.queryByRole("button", { name: /Increase Tempo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Decrease Tempo/ })).toBeNull();
  });

  it("shows a spinner on the play button while loading during playback", () => {
    const store = makeAtomStore([...playableAtoms, [progressionPlaybackLoadingAtom, true]]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    // The spinner replaces the play/stop glyph while a restart-tier build runs.
    expect(screen.getByTestId("transport-play-spinner")).toBeInTheDocument();
    // The button stays enabled so the user can cancel a slow load.
    expect(screen.getByRole("button", { name: "Stop progression" })).toBeEnabled();
  });

  it("lets the user cancel a slow load by clicking the spinner", () => {
    const store = makeAtomStore([...playableAtoms, [progressionPlaybackLoadingAtom, true]]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    const button = screen.getByRole("button", { name: "Stop progression" });
    expect(screen.getByTestId("transport-play-spinner")).toBeInTheDocument();
    expect(button).toBeEnabled();

    fireEvent.click(button);

    // Cancelling stops playback (returns to bar 1, stopped).
    expect(store.get(progressionPlayingAtom)).toBe(false);
  });

  it("clicking Stop progression sets playing=false and activeIndex=0", () => {
    const store = makeAtomStore([
      ...playableAtoms,
      [activeProgressionStepIndexAtom, 1],
    ]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Stop progression" }));

    expect(store.get(progressionPlayingAtom)).toBe(false);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("does not show tooltips for transport buttons", () => {
    renderWithAtoms(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>,[...playableAtoms]);

    const buttons = [
      screen.getByRole("button", { name: "Play progression" }),
      screen.getByRole("button", { name: "Loop progression" }),
    ];

    for (const button of buttons) {
      fireEvent.mouseOver(button);
      expect(screen.queryByRole("tooltip")).toBeNull();
    }
  });

  it("keeps the status label as Play while the progression plays (no text swap)", () => {
    const store = makeAtomStore([...playableAtoms]);
    const { container } = renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    expect(screen.getByText("Play")).toBeTruthy();

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    // Label text is static; playback is signalled by the active status dot, not a word swap.
    expect(screen.getByText("Play")).toBeTruthy();
    expect(screen.queryByText("Playing")).toBeNull();
    expect(container.querySelector('[data-active="true"]')).toBeInTheDocument();
  });

  it("announces the global edit lock via an aria-live region while playing", () => {
    const store = makeAtomStore([...playableAtoms]);
    const { container } = renderWithStore(
      <TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>,
      store,
    );

    const liveRegion = container.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("");

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    expect(liveRegion).toHaveTextContent("Editing locked during playback");
  });
});

describe("Concurrent UI Transitions", () => {
  // Regression guard: the play click must NOT wrap the Jotai setter in
  // React.startTransition. Doing so tagged every progression-atom subscriber's
  // rerender to the transition and tripped React's ">10 fibers inside
  // startTransition" subscription warning. The state change commits directly.
  it("starts playback without wrapping the write in startTransition", () => {
    const startTransitionSpy = vi.spyOn(React, "startTransition");
    const store = makeAtomStore([...playableAtoms]);
    renderWithStore(<TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>, store);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
    });

    expect(startTransitionSpy).not.toHaveBeenCalled();
    expect(store.get(progressionPlayingAtom)).toBe(true);
    startTransitionSpy.mockRestore();
  });
});
