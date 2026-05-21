// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import React from "react";
import { createStore, Provider } from "jotai";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { scaleVisibleAtom } from "../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../store/chordOverlayAtoms";

function makeWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("useKeyboardShortcuts", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    // Seed known defaults
    store.set(scaleVisibleAtom, true);
    store.set(chordOverlayHiddenAtom, false);
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
});
