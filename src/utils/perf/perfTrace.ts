interface PerfTraceDetail {
  name: string;
  durationMs: number;
  meta: Record<string, unknown>;
}

declare global {
  interface WindowEventMap {
    "__fretflow_perf__": CustomEvent<PerfTraceDetail>;
  }
}

function tracingEnabled(): boolean {
  try {
    return localStorage.getItem("ff.perf.enabled") === "true";
  } catch {
    return false;
  }
}

export function tracePerf<T>(
  name: string,
  meta: Record<string, unknown>,
  fn: () => T,
): T {
  const start = performance.now();
  const result = fn();
  if (tracingEnabled()) {
    const durationMs = performance.now() - start;
    window.dispatchEvent(
      new CustomEvent<PerfTraceDetail>("__fretflow_perf__", {
        detail: { name, durationMs, meta },
      }),
    );
  }
  return result;
}
