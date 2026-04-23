// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useResolvedTheme } from "./useResolvedTheme";
import { themeAtom } from "../store/atoms";
import { createStore, Provider } from "jotai";
import React from "react";

describe("useResolvedTheme", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    vi.clearAllMocks();
    
    // Default mock for matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  it("returns modern-dark when theme is dark", () => {
    store.set(themeAtom, "dark");
    const { result } = renderHook(() => useResolvedTheme(), { wrapper });
    expect(result.current).toBe("modern-dark");
  });

  it("returns modern-light when theme is light", () => {
    store.set(themeAtom, "light");
    const { result } = renderHook(() => useResolvedTheme(), { wrapper });
    expect(result.current).toBe("modern-light");
  });

  it("follows system preference when theme is system (dark)", () => {
    store.set(themeAtom, "system");
    
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => useResolvedTheme(), { wrapper });
    expect(result.current).toBe("modern-dark");
  });

  it("follows system preference when theme is system (light)", () => {
    store.set(themeAtom, "system");
    
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === "(prefers-color-scheme: light)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => useResolvedTheme(), { wrapper });
    expect(result.current).toBe("modern-light");
  });

  it("updates when system preference changes", () => {
    store.set(themeAtom, "system");
    
    let changeHandler: ((e: { matches: boolean }) => void) | null = null;
    
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((type, handler) => {
          if (type === "change") changeHandler = handler;
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result, rerender } = renderHook(() => useResolvedTheme(), { wrapper });
    expect(result.current).toBe("modern-light");

    if (changeHandler) {
      changeHandler({ matches: true });
    }
    
    // We need to trigger a rerender because the effect updates state
    rerender();
    expect(result.current).toBe("modern-dark");
  });
});
