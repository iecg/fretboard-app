import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";
import {
  displayedStepIndexPrimitiveAtom,
} from "../../store/progressionAtoms";
import { startVisualClock, stopVisualClock } from "./visualClock";
import * as timeline from "./timeline";

describe("visualClock", () => {
  let rafCb: FrameRequestCallback | null = null;
  let rafId = 0;
  beforeEach(() => {
    rafId = 0;
    rafCb = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCb = cb;
      return ++rafId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      if (id === rafId) rafCb = null;
    });
  });
  afterEach(() => {
    stopVisualClock();
    vi.restoreAllMocks();
  });

  function tick() {
    const cb = rafCb;
    rafCb = null;
    cb?.(performance.now());
  }

  it("writes stepIndex to the primitive atom every frame stepIndex changes", () => {
    const store = createStore();
    const positions = [
      { stepIndex: 0, globalFraction: 0, localFraction: 0, paused: false },
      { stepIndex: 0, globalFraction: 0.5, localFraction: 0.5, paused: false },
      { stepIndex: 1, globalFraction: 0.6, localFraction: 0, paused: false },
    ];
    let i = 0;
    vi.spyOn(timeline, "getTimelinePosition").mockImplementation(
      () => positions[Math.min(i, positions.length - 1)] ?? null,
    );

    startVisualClock(store);

    tick(); i++;
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(0);
    tick(); i++;
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(0);
    tick();
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(1);
  });

  it("is idempotent on start", () => {
    const store = createStore();
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
      stepIndex: 2, globalFraction: 0, localFraction: 0, paused: false,
    });
    startVisualClock(store);
    startVisualClock(store); // second call must not double-schedule
    tick();
    expect(store.get(displayedStepIndexPrimitiveAtom)).toBe(2);
  });

  it("stops scheduling after stop()", () => {
    const store = createStore();
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
      stepIndex: 3, globalFraction: 0, localFraction: 0, paused: false,
    });
    startVisualClock(store);
    tick();
    stopVisualClock();
    expect(rafCb).toBeNull();
  });
});
