import { beforeEach, describe, expect, it, vi } from "vitest";
import { tracePerf } from "./perfTrace";

describe("tracePerf", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not emit anything when tracing is disabled", () => {
    const listener = vi.fn();
    window.addEventListener("__fretflow_perf__", listener);
    try {
      const result = tracePerf("my-trace", { steps: 2 }, () => 42);
      expect(result).toBe(42);
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("__fretflow_perf__", listener);
    }
  });

  it("emits a detail event when tracing is enabled", () => {
    localStorage.setItem("ff.perf.enabled", "true");
    let captured: CustomEvent | null = null;
    const listener = (e: CustomEvent) => { captured = e; };
    window.addEventListener("__fretflow_perf__", listener as EventListener);
    try {
      const result = tracePerf("my-trace", { steps: 2 }, () => 42);
      expect(result).toBe(42);
      expect(captured).not.toBeNull();
      expect((captured as unknown as CustomEvent<{ name: string; meta: { steps: number } }>).detail.name).toBe("my-trace");
      expect((captured as unknown as CustomEvent<{ name: string; meta: { steps: number } }>).detail.meta.steps).toBe(2);
    } finally {
      window.removeEventListener("__fretflow_perf__", listener as EventListener);
    }
  });
});
