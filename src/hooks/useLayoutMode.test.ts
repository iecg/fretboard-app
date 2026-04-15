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
    it("tier is mobile and stringRowPx is 32 at 375x667", () => {
      setViewport(375, 667);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(result.current.tier).toBe("mobile");
      expect(result.current.stringRowPx).toBe(32);
    });
  });

  describe("returns tablet tier layout for tablet viewport", () => {
    it("tier is tablet and stringRowPx is 40 at 768x1024", () => {
      setViewport(768, 1024);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(result.current.tier).toBe("tablet");
      expect(result.current.stringRowPx).toBe(40);
    });
  });

  describe("returns desktop tier layout for wide viewport", () => {
    it("tier is desktop and stringRowPx is 48 at 1280x900", () => {
      setViewport(1280, 900);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(result.current.tier).toBe("desktop");
      expect(result.current.stringRowPx).toBe(48);
    });
  });

  describe("updates layout on window resize", () => {
    it("re-computes tier when viewport changes from mobile to desktop", () => {
      setViewport(375, 667);
      const { result } = renderHook(() => useLayoutMode(), { wrapper });
      expect(result.current.tier).toBe("mobile");

      act(() => {
        setViewport(1280, 900);
        fireEvent(window, new Event("resize"));
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
