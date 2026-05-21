// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../test-utils/renderWithAtoms";
import { isMutedAtom } from "../store/audioAtoms";
import { chordRootAtom } from "../store/chordOverlayAtoms";
import { beatsPerBarAtom, progressionStepsAtom, progressionTempoBpmAtom, setProgressionPlayingAtom } from "../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../store/scaleAtoms";

// Mock Tone before importing modules that touch it. The production hook calls
// `getTransport().scheduleOnce(cb, audioCtxTime)` against the shared audio
// clock — but `Tone.Transport.scheduleOnce` doesn't fire under
// `vi.advanceTimersByTime`. We translate the scheduled callback into a
// real `setTimeout` (which fake timers DO control) by reading the synthetic
// AudioContext currentTime via `toneContextNow`. The existing tests then
// continue to drive the loop via `vi.advanceTimersByTime` unchanged.
const toneMocks = vi.hoisted(() => {
  const contextNowRef = { fn: () => 0 };
  let nextEventId = 1;
  const events = new Map<number, ReturnType<typeof setTimeout>>();

  const scheduleOnce = vi.fn((cb: (time: number) => void, time: number) => {
    const id = nextEventId++;
    const delayMs = Math.max(0, (time - contextNowRef.fn()) * 1000);
    const timerId = setTimeout(() => {
      events.delete(id);
      cb(time);
    }, delayMs);
    events.set(id, timerId);
    return id;
  });

  const clear = vi.fn((id: number) => {
    const timerId = events.get(id);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      events.delete(id);
    }
    return transport;
  });

  const transport: {
    scheduleOnce: typeof scheduleOnce;
    clear: typeof clear;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    bpm: { value: number };
    seconds: number;
  } = {
    scheduleOnce,
    clear,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    bpm: { value: 120 },
    seconds: 0,
  };

  const getTransport = vi.fn(() => transport);
  const setContext = vi.fn();
  const getContext = vi.fn(() => ({ now: () => contextNowRef.fn() }));
  const now = vi.fn(() => contextNowRef.fn());

  const _resetEvents = () => {
    for (const timerId of events.values()) clearTimeout(timerId);
    events.clear();
    nextEventId = 1;
  };

  return {
    contextNowRef,
    scheduleOnce,
    clear,
    transport,
    getTransport,
    setContext,
    getContext,
    now,
    _resetEvents,
  };
});

vi.mock("tone", () => ({
  setContext: toneMocks.setContext,
  getContext: toneMocks.getContext,
  getTransport: toneMocks.getTransport,
  now: toneMocks.now,
}));

import {
  _resetTimelineForTests,
  pauseTimeline,
  resumeTimelineAtCurrentTime,
  setActiveStep,
} from "../progressions/audio/timeline";
import { _resetProgressionAudioForTests } from "../progressions/audio/bus";
import { useProgressionPlaybackLoop } from "./useProgressionPlaybackLoop";

const threeChordProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "beat" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "beat" }, qualityOverride: null },
  { id: "three", degree: "vi", duration: { value: 1, unit: "beat" }, qualityOverride: null },
] as const;

function PlaybackLoopHarness() {
  useProgressionPlaybackLoop();
  return null;
}

describe("useProgressionPlaybackLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    // isMutedAtom is an atomWithStorage — clear persisted state so a muted
    // seed in one test never leaks into the next.
    localStorage.clear();
    _resetTimelineForTests();
    _resetProgressionAudioForTests();
    toneMocks._resetEvents();
    toneMocks.scheduleOnce.mockClear();
    toneMocks.clear.mockClear();

    const audioContext = {
      get currentTime() {
        return Date.now() / 1000;
      },
      sampleRate: 44100,
      state: "running" as AudioContextState,
      createGain: () => ({
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          setTargetAtTime: vi.fn(),
        },
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
      }),
      destination: {} as AudioDestinationNode,
      resume: vi.fn(),
    };

    // Wire the Tone mock's clock to the synthetic AudioContext so
    // `scheduleOnce(cb, audio.ctx.currentTime + Δ)` arms a setTimeout with
    // delay Δ — the existing fake-timer-driven assertions still apply.
    toneMocks.contextNowRef.fn = () => audioContext.currentTime;

    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () {
        return audioContext;
      }) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances the active progression chord as soon as the audio step ends", () => {
    const tempoBpm = 61;
    const stepDurationMs = 60000 / tempoBpm;
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, tempoBpm],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    setActiveStep(0, 0, stepDurationMs / 1000, 0, 10);

    renderWithStore(<PlaybackLoopHarness />, store);

    expect(store.get(chordRootAtom)).toBe("C");

    act(() => {
      vi.advanceTimersByTime(Math.ceil(stepDurationMs));
    });

    expect(store.get(chordRootAtom)).toBe("G");
  });

  it("stays inert while muted — no advance and no 0ms hot loop", () => {
    // While muted, useProgressionAudioPlayback clears the timeline. The loop
    // must not spin re-arming against a null timeline; advancing fake timers
    // by a long span here would abort the test if a 0ms hot loop existed.
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [isMutedAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    setActiveStep(0, 0, 1.0, 0, 10);

    renderWithStore(<PlaybackLoopHarness />, store);

    expect(store.get(chordRootAtom)).toBe("C");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(store.get(chordRootAtom)).toBe("C");
  });

  it("advances multiple chords correctly when the timeline stays in sync", () => {
    const tempoBpm = 60; // 1 beat = 1000ms
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, tempoBpm],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    
    // Initially at step 0
    setActiveStep(0, 0, 1.0, 0, 10);

    renderWithStore(<PlaybackLoopHarness />, store);

    expect(store.get(chordRootAtom)).toBe("C");

    // Advance to end of first step
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should have advanced to step 1 (G)
    expect(store.get(chordRootAtom)).toBe("G");

    // Timeline is still at step 0 (stale)
    // The loop should be in a retry state, not advancing further.
    act(() => {
      vi.advanceTimersByTime(100); // Some more time
    });
    expect(store.get(chordRootAtom)).toBe("G");

    // Now update timeline to step 1
    act(() => {
      setActiveStep(1, 1.0, 1.0, 1.0, 10);
    });

    // Still at G, but now it should have armed the next advance for t=2.0
    expect(store.get(chordRootAtom)).toBe("G");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should have advanced to step 2 (Am, root is A)
    expect(store.get(chordRootAtom)).toBe("A");
  });

  it("resumes correctly and advances at the right time after a pause/resume cycle", () => {
    const tempoBpm = 60; // 1 beat = 1000ms
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, tempoBpm],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);

    // Step 0: start=0, duration=1s
    setActiveStep(0, 0, 1.0, 0, 10);

    renderWithStore(<PlaybackLoopHarness />, store);

    expect(store.get(chordRootAtom)).toBe("C");

    // Advance 0.5s
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Pause
    act(() => {
      store.set(setProgressionPlayingAtom, false);
      pauseTimeline();
    });

    // Advance time 5s
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(store.get(chordRootAtom)).toBe("C");

    // Resume
    act(() => {
      store.set(setProgressionPlayingAtom, true);
      resumeTimelineAtCurrentTime();
    });

    // Now it's re-anchored to the current time (5.5s)
    // It should advance after 1s (the full duration of the step from resume)

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(store.get(chordRootAtom)).toBe("C");

    act(() => {
      vi.advanceTimersByTime(101);
    });
    expect(store.get(chordRootAtom)).toBe("G");
  });

  it("arms advance via Transport.scheduleOnce at the audio-clock boundary", () => {
    const tempoBpm = 60; // 1 beat = 1.0s
    const stepDurationSec = 1.0;
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, tempoBpm],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    // Timeline armed at audio start time 0, duration 1s.
    setActiveStep(0, 0, stepDurationSec, 0, 10);

    renderWithStore(<PlaybackLoopHarness />, store);

    expect(toneMocks.scheduleOnce).toHaveBeenCalledTimes(1);
    const [callback, boundaryTime] = toneMocks.scheduleOnce.mock.calls[0];
    expect(typeof callback).toBe("function");
    // audio.ctx.currentTime is 0 at this point, remaining = 1s → boundary 1.0.
    expect(boundaryTime).toBeCloseTo(1.0, 5);
  });

  it("clears the scheduled callback on effect cleanup", () => {
    const tempoBpm = 60;
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, tempoBpm],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    setActiveStep(0, 0, 1.0, 0, 10);

    const { unmount } = renderWithStore(<PlaybackLoopHarness />, store);

    expect(toneMocks.scheduleOnce).toHaveBeenCalledTimes(1);
    const scheduledId = toneMocks.scheduleOnce.mock.results[0].value;

    unmount();

    expect(toneMocks.clear).toHaveBeenCalledWith(scheduledId);
  });
});
