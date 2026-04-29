// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { createElement } from "react";
import { useCompactDensity } from "./useCompactDensity";
import { compactDensityAtom } from "../store/atoms";

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
}

function makeWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(Provider, { store }, children);
}

describe("useCompactDensity", () => {
  it("returns true on mobile viewport when atom is 'auto'", () => {
    setViewport(390, 844);
    const store = createStore();
    store.set(compactDensityAtom, "auto");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(true);
  });

  it("returns true on mobile viewport when atom is 'on'", () => {
    setViewport(390, 844);
    const store = createStore();
    store.set(compactDensityAtom, "on");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(true);
  });

  it("returns false on mobile viewport when atom is 'off'", () => {
    setViewport(390, 844);
    const store = createStore();
    store.set(compactDensityAtom, "off");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(false);
  });

  it("returns false on desktop viewport when atom is 'auto'", () => {
    setViewport(1440, 900);
    const store = createStore();
    store.set(compactDensityAtom, "auto");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(false);
  });

  it("returns true on desktop viewport when atom is 'on'", () => {
    setViewport(1440, 900);
    const store = createStore();
    store.set(compactDensityAtom, "on");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(true);
  });

  it("returns false on desktop viewport when atom is 'off'", () => {
    setViewport(1440, 900);
    const store = createStore();
    store.set(compactDensityAtom, "off");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(false);
  });

  it("returns true on tablet-split (portrait tablet) when atom is 'auto'", () => {
    // 768x1024 → tablet-split → tab bar shown → compact forced on
    setViewport(768, 1024);
    const store = createStore();
    store.set(compactDensityAtom, "auto");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(true);
  });

  it("returns false on tablet-stacked (short tablet) when atom is 'auto'", () => {
    // 768x400 → tablet-stacked (compact height) → controls panel shown → respect auto -> false
    setViewport(768, 400);
    const store = createStore();
    store.set(compactDensityAtom, "auto");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(false);
  });

  it("returns true on tablet viewport when atom is 'on'", () => {
    setViewport(768, 1024);
    const store = createStore();
    store.set(compactDensityAtom, "on");
    const { result } = renderHook(() => useCompactDensity(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current).toBe(true);
  });
});
