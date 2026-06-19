import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { type ReactNode } from "react";
import { urlOverridesAtom } from "../store/urlOverrideAtoms";
import { useShareLinkHandler } from "./useShareLinkHandler";

function createWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

describe("useShareLinkHandler", () => {
  const originalLocation = window.location;
  const replaceStateSpy = vi.spyOn(window.history, "replaceState");

  beforeEach(() => {
    replaceStateSpy.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("sets urlOverridesAtom when share param is present", async () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/?s=C.major.120.4x4.I-V-vi-IV"),
      writable: true,
    });
    const store = createStore();
    renderHook(() => useShareLinkHandler(), { wrapper: createWrapper(store) });
    await waitFor(() => {
      const overrides = store.get(urlOverridesAtom);
      expect(overrides).not.toBeNull();
      expect(overrides?.root).toBe("C");
      expect(overrides?.steps).toHaveLength(4);
    });
  });

  it("strips query params after parsing", async () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/?s=C.major.120.4x4.I"),
      writable: true,
    });
    const store = createStore();
    renderHook(() => useShareLinkHandler(), { wrapper: createWrapper(store) });
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", expect.not.stringContaining("?s="));
    });
  });

  it("does nothing when no share params present", () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/"),
      writable: true,
    });
    const store = createStore();
    renderHook(() => useShareLinkHandler(), { wrapper: createWrapper(store) });
    expect(store.get(urlOverridesAtom)).toBeNull();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it("ignores malformed share params", async () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/?s=garbage"),
      writable: true,
    });
    const store = createStore();
    renderHook(() => useShareLinkHandler(), { wrapper: createWrapper(store) });
    // Wait a bit to ensure it doesn't set it asynchronously
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(store.get(urlOverridesAtom)).toBeNull();
  });
});
