import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mutable fake context state, driven per-test.
const h = vi.hoisted(() => ({
  state: "running" as AudioContextState,
  currentTime: 0,
  contextTime: 0 as number | undefined,
  hasTimestamp: true,
}));

vi.mock("tone", () => ({
  getContext: () => ({
    rawContext: {
      get state() {
        return h.state;
      },
      get currentTime() {
        return h.currentTime;
      },
      getOutputTimestamp: h.hasTimestamp
        ? () => ({ contextTime: h.contextTime })
        : undefined,
    },
  }),
}));

import { probeOutputHealth } from "./audioOutputHealth";

/** Run the probe, advancing the fake 250ms window after applying the
 *  "second sample" values supplied in `after`. */
async function runProbe(after: { currentTime?: number; contextTime?: number }) {
  const p = probeOutputHealth(); // first sample taken synchronously
  if (after.currentTime !== undefined) h.currentTime = after.currentTime;
  if (after.contextTime !== undefined) h.contextTime = after.contextTime;
  await vi.advanceTimersByTimeAsync(300);
  return p;
}

describe("probeOutputHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.state = "running";
    h.currentTime = 0;
    h.contextTime = 0;
    h.hasTimestamp = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports healthy when the hardware clock keeps pace with currentTime", async () => {
    const result = await runProbe({ currentTime: 0.25, contextTime: 0.24 });
    expect(result).toBe("healthy");
  });

  it("reports wedged when currentTime advances but the hardware clock is frozen", async () => {
    const result = await runProbe({ currentTime: 0.25, contextTime: 0 });
    expect(result).toBe("wedged");
  });

  it("reports unknown when getOutputTimestamp is unsupported", async () => {
    h.hasTimestamp = false;
    const result = await runProbe({ currentTime: 0.25 });
    expect(result).toBe("unknown");
  });

  it("reports unknown when getOutputTimestamp returns no contextTime", async () => {
    h.contextTime = undefined;
    const result = await runProbe({ currentTime: 0.25, contextTime: undefined });
    expect(result).toBe("unknown");
  });

  it("reports unknown when the context is suspended", async () => {
    h.state = "suspended";
    const result = await runProbe({ currentTime: 0.25, contextTime: 0 });
    expect(result).toBe("unknown");
  });

  it("reports unknown when currentTime barely advanced (inconclusive)", async () => {
    const result = await runProbe({ currentTime: 0.05, contextTime: 0 });
    expect(result).toBe("unknown");
  });

  it("probes an explicitly-passed context instead of the Tone global", async () => {
    // A standalone context whose hardware clock is frozen while currentTime
    // advances → wedged. The Tone-global mock (h.*) stays healthy, proving the
    // explicit arg is what's used.
    let ct = 0;
    const explicitCtx = {
      state: "running" as AudioContextState,
      get currentTime() {
        return ct;
      },
      getOutputTimestamp: () => ({ contextTime: 0 }),
    } as unknown as AudioContext;

    const p = probeOutputHealth(explicitCtx);
    ct = 0.25; // currentTime advanced; contextTime stayed 0
    await vi.advanceTimersByTimeAsync(300);
    expect(await p).toBe("wedged");
  });
});
