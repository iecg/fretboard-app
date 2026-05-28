import { describe, it, expect } from "vitest";
import { renderHook, act, fireEvent } from "@testing-library/react";
import { Provider } from "jotai";
import { createElement } from "react";
import useLayoutMode from "./useLayoutMode";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(Provider, null, children);

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

describe("useLayoutMode", () => {
  describe("returns mobile tier layout for narrow viewport", () => {
    it("tier is mobile and stringRowPx is 34 at 375x667", () => {
      setViewport(375, 667);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(result.current.tier).toBe("mobile");
      expect(result.current.stringRowPx).toBe(34);
    });
  });

  describe("returns tablet tier layout for tablet viewport", () => {
    it("tier is tablet and stringRowPx is 36 at 768x1024", () => {
      setViewport(768, 1024);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(result.current.tier).toBe("tablet");
      expect(result.current.stringRowPx).toBe(36);
    });
  });

  describe("returns desktop tier layout for wide viewport", () => {
    it("tier is desktop and stringRowPx is 42 at 1280x900", () => {
      setViewport(1280, 900);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(result.current.tier).toBe("desktop");
      expect(result.current.stringRowPx).toBe(42);
    });
  });

  describe("updates layout on window resize", () => {
    it("re-computes tier when viewport changes from mobile to desktop", async () => {
      setViewport(375, 667);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(result.current.tier).toBe("mobile");

      await act(async () => {
        setViewport(1280, 900);
        fireEvent(window, new Event("resize"));
        await new Promise((resolve) =>
          window.requestAnimationFrame(() => resolve(undefined)),
        );
      });

      expect(result.current.tier).toBe("desktop");
    });
  });

  describe("stringRowPx is accessible as layout.stringRowPx", () => {
    it("returns a numeric stringRowPx field on the layout object", () => {
      setViewport(1280, 900);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(typeof result.current.stringRowPx).toBe("number");
      expect(result.current.stringRowPx).toBeGreaterThan(0);
    });
  });
});

describe("useLayoutMode showStatusBar", () => {
  it("is true on the desktop tier (1280x900)", () => {
    setViewport(1280, 900);
    const { result } = renderHook(() => useLayoutMode(), { wrapper });
    expect(result.current.showStatusBar).toBe(true);
  });

  it("is false on the tablet-split variant (768x1024)", () => {
    setViewport(768, 1024);
    const { result } = renderHook(() => useLayoutMode(), { wrapper });
    expect(result.current.variant).toBe("tablet-split");
    expect(result.current.showStatusBar).toBe(false);
  });

  it("is false on the mobile tier (375x667)", () => {
    setViewport(375, 667);
    const { result } = renderHook(() => useLayoutMode(), { wrapper });
    expect(result.current.showStatusBar).toBe(false);
  });

  it("is true on the tablet-stacked variant", () => {
    setViewport(900, 700);
    const { result } = renderHook(() => useLayoutMode(), { wrapper });
    expect(result.current.variant).toBe("tablet-stacked");
    expect(result.current.showStatusBar).toBe(true);
  });

  it("coalesces a resize burst into one state commit per animation frame", () => {
    let rafCallback: FrameRequestCallback | null = null;
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    }) as typeof window.requestAnimationFrame;

    setViewport(375, 667);
    const { result } = renderHook(() => useLayoutMode(), { wrapper });
    expect(result.current.tier).toBe("mobile");

    act(() => {
      setViewport(768, 1024);
      fireEvent(window, new Event("resize"));
      setViewport(1280, 900);
      fireEvent(window, new Event("resize"));
    });

    expect(result.current.tier).toBe("mobile");

    act(() => {
      rafCallback?.(16);
    });

    expect(result.current.tier).toBe("desktop");
    window.requestAnimationFrame = originalRaf;
  });
});
