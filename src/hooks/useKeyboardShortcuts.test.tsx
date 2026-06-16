// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import React from "react";
import { createStore, Provider } from "jotai";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { scaleVisibleAtom } from "../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../store/chordOverlayAtoms";
import {
  progressionPlayingAtom,
  activeProgressionStepIndexAtom,
  setProgressionPlayingAtom,
  progressionLoopEnabledAtom,
  progressionChordEnabledAtom,
  progressionBassEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionMetronomeEnabledAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
} from "../store/progressionAtoms";
import { isMutedAtom } from "../store/audioAtoms";
import {
  TEMPO_STEPPER_ID,
  PROGRESSION_STEP_LIST_ID,
} from "../components/SongControls/progressionFocusIds";

function makeWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

const threeSteps = () => [
  { id: "a", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
  { id: "b", degree: "V", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
  { id: "c", degree: "vi", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null },
];

describe("useKeyboardShortcuts", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    // Seed known defaults
    store.set(scaleVisibleAtom, true);
    store.set(chordOverlayHiddenAtom, false);
    store.set(progressionLoopEnabledAtom, false);
    store.set(progressionChordEnabledAtom, true);
    store.set(progressionBassEnabledAtom, true);
    store.set(progressionDrumsEnabledAtom, true);
    store.set(progressionMetronomeEnabledAtom, true);
    store.set(isMutedAtom, false);
  });

  it("S toggles scaleVisibleAtom from true to false", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "s" });
    });

    expect(store.get(scaleVisibleAtom)).toBe(false);
  });

  it("S toggles scaleVisibleAtom from false back to true", () => {
    store.set(scaleVisibleAtom, false);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "s" });
    });

    expect(store.get(scaleVisibleAtom)).toBe(true);
  });

  it("uppercase S also toggles scaleVisibleAtom", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "S" });
    });

    expect(store.get(scaleVisibleAtom)).toBe(false);
  });

  it("C toggles chordOverlayHiddenAtom from false to true", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "c" });
    });

    expect(store.get(chordOverlayHiddenAtom)).toBe(true);
  });

  it("C toggles chordOverlayHiddenAtom from true back to false", () => {
    store.set(chordOverlayHiddenAtom, true);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "c" });
    });

    expect(store.get(chordOverlayHiddenAtom)).toBe(false);
  });

  it("uppercase C also toggles chordOverlayHiddenAtom", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "C" });
    });

    expect(store.get(chordOverlayHiddenAtom)).toBe(true);
  });

  it("does not toggle when focus is inside an INPUT element", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      fireEvent.keyDown(input, { key: "s" });
    });

    expect(store.get(scaleVisibleAtom)).toBe(true);
    document.body.removeChild(input);
  });

  it("does not toggle when focus is inside a TEXTAREA element", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    act(() => {
      fireEvent.keyDown(textarea, { key: "c" });
    });

    expect(store.get(chordOverlayHiddenAtom)).toBe(false);
    document.body.removeChild(textarea);
  });

  it("does not toggle when Cmd+S is pressed (metaKey)", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "s", metaKey: true });
    });

    expect(store.get(scaleVisibleAtom)).toBe(true);
  });

  it("does not toggle when Ctrl+S is pressed (ctrlKey)", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "s", ctrlKey: true });
    });

    expect(store.get(scaleVisibleAtom)).toBe(true);
  });

  it("removes the event listener on unmount", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(), {
      wrapper: makeWrapper(store),
    });

    unmount();

    act(() => {
      fireEvent.keyDown(document, { key: "s" });
    });

    // Scale should remain unchanged after unmount
    expect(store.get(scaleVisibleAtom)).toBe(true);
  });

  it("Space toggles progression playing when not blocked", () => {
    store.set(setProgressionPlayingAtom, false);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: " " });
    });

    expect(store.get(progressionPlayingAtom)).toBe(true);

    act(() => {
      fireEvent.keyDown(document, { key: " " });
    });

    expect(store.get(progressionPlayingAtom)).toBe(false);
  });

  it("Space does nothing when focus is in INPUT", () => {
    store.set(setProgressionPlayingAtom, false);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      fireEvent.keyDown(input, { key: " " });
    });

    expect(store.get(progressionPlayingAtom)).toBe(false);
    document.body.removeChild(input);
  });

  it("period stops playback and rewinds step index", () => {
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 2);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => {
      fireEvent.keyDown(document, { key: "." });
    });

    expect(store.get(progressionPlayingAtom)).toBe(false);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("R toggles loop enabled", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "r" }); });
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);

    act(() => { fireEvent.keyDown(document, { key: "R" }); });
    expect(store.get(progressionLoopEnabledAtom)).toBe(false);
  });

  it("M toggles mute", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "m" }); });
    expect(store.get(isMutedAtom)).toBe(true);

    act(() => { fireEvent.keyDown(document, { key: "M" }); });
    expect(store.get(isMutedAtom)).toBe(false);
  });

  it("1 toggles chord layer", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "1" }); });
    expect(store.get(progressionChordEnabledAtom)).toBe(false);

    act(() => { fireEvent.keyDown(document, { key: "1" }); });
    expect(store.get(progressionChordEnabledAtom)).toBe(true);
  });

  it("2 toggles bass layer", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });
    act(() => { fireEvent.keyDown(document, { key: "2" }); });
    expect(store.get(progressionBassEnabledAtom)).toBe(false);
  });

  it("3 toggles drums layer", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });
    act(() => { fireEvent.keyDown(document, { key: "3" }); });
    expect(store.get(progressionDrumsEnabledAtom)).toBe(false);
  });

  it("4 toggles metronome layer", () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });
    act(() => { fireEvent.keyDown(document, { key: "4" }); });
    expect(store.get(progressionMetronomeEnabledAtom)).toBe(false);
  });

  it("ArrowRight advances step when not playing", () => {
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 0);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });

    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });

  it("ArrowRight does nothing when playing", () => {
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 0);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });

    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("ArrowLeft goes to previous step when not playing", () => {
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 2);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowLeft" }); });

    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });

  it("ArrowLeft does nothing when playing", () => {
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 2);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowLeft" }); });

    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
  });

  it("ArrowUp moves focus to the tempo stepper when it is present", () => {
    store.set(progressionTempoBpmAtom, 100);
    const el = document.createElement("div");
    el.id = TEMPO_STEPPER_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowUp" }); });

    expect(store.get(progressionTempoBpmAtom)).toBe(105);
    expect(document.activeElement).toBe(el);
    document.body.removeChild(el);
  });

  it("ArrowDown moves focus to the tempo stepper when it is present", () => {
    store.set(progressionTempoBpmAtom, 100);
    const el = document.createElement("div");
    el.id = TEMPO_STEPPER_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });

    expect(store.get(progressionTempoBpmAtom)).toBe(95);
    expect(document.activeElement).toBe(el);
    document.body.removeChild(el);
  });

  it("ArrowUp still changes tempo and does not throw when the stepper is absent", () => {
    store.set(progressionTempoBpmAtom, 100);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowUp" }); });

    expect(store.get(progressionTempoBpmAtom)).toBe(105);
  });

  it("ArrowRight moves focus to the chord list when not playing", () => {
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 0);
    const el = document.createElement("div");
    el.id = PROGRESSION_STEP_LIST_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });

    expect(document.activeElement).toBe(el);
    document.body.removeChild(el);
  });

  it("ArrowLeft moves focus to the chord list when not playing", () => {
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 2);
    const el = document.createElement("div");
    el.id = PROGRESSION_STEP_LIST_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowLeft" }); });

    expect(document.activeElement).toBe(el);
    document.body.removeChild(el);
  });

  it("ArrowRight does not move focus to the chord list while playing", () => {
    store.set(setProgressionPlayingAtom, true);
    store.set(activeProgressionStepIndexAtom, 0);
    const el = document.createElement("div");
    el.id = PROGRESSION_STEP_LIST_ID;
    el.tabIndex = -1;
    document.body.appendChild(el);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });

    expect(document.activeElement).not.toBe(el);
    document.body.removeChild(el);
  });

  it("Alt+ArrowDown moves the active step later", () => {
    store.set(progressionStepsAtom, threeSteps());
    store.set(activeProgressionStepIndexAtom, 0);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown", altKey: true }); });

    expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });

  it("Alt+ArrowUp moves the active step earlier", () => {
    store.set(progressionStepsAtom, threeSteps());
    store.set(activeProgressionStepIndexAtom, 2);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowUp", altKey: true }); });

    expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(store.get(activeProgressionStepIndexAtom)).toBe(1);
  });

  it("Alt+ArrowUp is a no-op at the first step", () => {
    store.set(progressionStepsAtom, threeSteps());
    store.set(activeProgressionStepIndexAtom, 0);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowUp", altKey: true }); });

    expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("plain ArrowUp/ArrowDown still change tempo (not swallowed by the Alt reorder branch)", () => {
    store.set(progressionStepsAtom, threeSteps());
    const before = store.get(progressionTempoBpmAtom);
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowUp" }); });
    expect(store.get(progressionTempoBpmAtom)).toBe(before + 5);

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });
    expect(store.get(progressionTempoBpmAtom)).toBe(before);

    // Order is unchanged: unmodified arrows never reorder.
    expect(store.get(progressionStepsAtom).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("ArrowRight does not advance the step when focus is inside the chord list", () => {
    store.set(setProgressionPlayingAtom, false);
    store.set(activeProgressionStepIndexAtom, 0);
    const list = document.createElement("div");
    list.id = PROGRESSION_STEP_LIST_ID;
    const row = document.createElement("button");
    list.appendChild(row);
    document.body.appendChild(list);
    row.focus();
    renderHook(() => useKeyboardShortcuts(), { wrapper: makeWrapper(store) });

    act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });

    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
    document.body.removeChild(list);
  });
});
