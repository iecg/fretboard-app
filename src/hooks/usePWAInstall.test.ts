import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePWAInstall } from "./usePWAInstall";

describe("usePWAInstall", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: not installed (standalone = false)
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  it("canInstall is false initially", () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.canInstall).toBe(false);
  });

  it("canInstall becomes true after beforeinstallprompt fires", () => {
    const { result } = renderHook(() => usePWAInstall());
    act(() => {
      window.dispatchEvent(new Event("beforeinstallprompt"));
    });
    expect(result.current.canInstall).toBe(true);
  });

  it("canInstall stays false if previously dismissed", () => {
    localStorage.setItem("fretflow:installDismissed", "true");
    const { result } = renderHook(() => usePWAInstall());
    act(() => {
      window.dispatchEvent(new Event("beforeinstallprompt"));
    });
    expect(result.current.canInstall).toBe(false);
  });

  it("dismiss sets localStorage flag and canInstall to false", () => {
    const { result } = renderHook(() => usePWAInstall());
    act(() => {
      window.dispatchEvent(new Event("beforeinstallprompt"));
    });
    expect(result.current.canInstall).toBe(true);
    act(() => { result.current.dismiss(); });
    expect(result.current.canInstall).toBe(false);
    expect(localStorage.getItem("fretflow:installDismissed")).toBe("true");
  });
});
