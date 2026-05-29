import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";
import {
  displayedStepIndexPrimitiveAtom,
} from "../../store/progressionAtoms";
import { progressionVisualFrameAtom } from "../../store/progressionVisualAtoms";
import { startVisualClock, stopVisualClock, subscribeVisualClock } from "./visualClock";
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

  it("publishes the full timeline frame on each RAF tick", () => {
    const store = createStore();
    const frames = [
      { stepIndex: 0, globalFraction: 0.1, localFraction: 0.2, paused: false },
      { stepIndex: 1, globalFraction: 0.5, localFraction: 0.3, paused: false },
      { stepIndex: 1, globalFraction: 0.8, localFraction: 0.6, paused: true },
    ];
    const mock = vi.spyOn(timeline, "getTimelinePosition");
    frames.forEach((f) => mock.mockReturnValueOnce(f));

    startVisualClock(store);

    tick();
    expect(store.get(progressionVisualFrameAtom)).toEqual(frames[0]);

    tick();
    expect(store.get(progressionVisualFrameAtom)).toEqual(frames[1]);

    tick();
    expect(store.get(progressionVisualFrameAtom)).toEqual(frames[2]);
  });

  it("clears the mirrored playback frame when the visual clock stops", () => {
    const store = createStore();
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
      stepIndex: 1,
      globalFraction: 0.25,
      localFraction: 0.25,
      paused: false,
    });

    startVisualClock(store);
    tick();
    stopVisualClock();

    expect(store.get(progressionVisualFrameAtom)).toBeNull();
  });

  it("clears progressionVisualFrameAtom when getTimelinePosition transitions to null mid-loop", () => {
    const store = createStore();
    const mock = vi.spyOn(timeline, "getTimelinePosition");
    mock.mockReturnValueOnce({
      stepIndex: 0,
      globalFraction: 0.1,
      localFraction: 0.1,
      paused: false,
    });
    mock.mockReturnValueOnce(null);

    startVisualClock(store);

    tick();
    expect(store.get(progressionVisualFrameAtom)).not.toBeNull();

    tick();
    expect(store.get(progressionVisualFrameAtom)).toBeNull();
  });

  it("notifies subscribers every frame with the timeline position", () => {
    const store = createStore();
    const mockPos = { stepIndex: 0, globalFraction: 0.1, localFraction: 0.1, paused: false };
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue(mockPos);

    const cb = vi.fn();
    const unsubscribe = subscribeVisualClock(cb);
    
    startVisualClock(store);
    tick();
    
    expect(cb).toHaveBeenCalledWith(mockPos);
    
    unsubscribe();
    tick();
    
    expect(cb).toHaveBeenCalledTimes(1); // Should not have been called a second time
  });
});
