// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../test-utils/renderWithAtoms";
import { isMutedAtom } from "../store/audioAtoms";
import { chordRootAtom } from "../store/chordOverlayAtoms";
import { beatsPerBarAtom, progressionStepsAtom, progressionTempoBpmAtom, setProgressionPlayingAtom } from "../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../store/scaleAtoms";

// Mock Tone before importing modules that touch it. The production hook calls
// `getTransport().scheduleOnce(cb, "+<seconds>")` using relative-time string
// syntax — but `Tone.Transport.scheduleOnce` doesn't fire under
// `vi.advanceTimersByTime`. We translate the scheduled callback into a
// real `setTimeout` (which fake timers DO control). The existing tests then
// continue to drive the loop via `vi.advanceTimersByTime` unchanged.
const toneMocks = vi.hoisted(() => {
  const contextNowRef = { fn: () => 0 };
  let nextEventId = 1;
  const events = new Map<number, ReturnType<typeof setTimeout>>();

  const scheduleOnce = vi.fn((cb: (time: number) => void, time: number | string) => {
    const id = nextEventId++;
    let delayMs: number;
    if (typeof time === "string" && time.startsWith("+")) {
      // Relative-time syntax — Tone parses "+x" as x seconds from transport
      // now. The hook uses this form to avoid TransportTime/ticks ambiguity.
      delayMs = Math.max(0, parseFloat(time.slice(1)) * 1000);
    } else if (typeof time === "number") {
      // Loud failure on regression: the hook must use the relative-time
      // string form. Numeric args have ambiguous semantics (ticks vs seconds)
      // and silently working around them here would mask real bugs.
      throw new Error("scheduleOnce: numeric time arg no longer supported (use relative-time string)");
    } else {
      delayMs = 0;
    }
    const timerId = setTimeout(() => {
      events.delete(id);
      cb(contextNowRef.fn());
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
  // `immediate()` returns `rawContext.currentTime` (no lookahead) — see
  // tone/build/esm/core/context/Context.js:339. The production hook reads
  // it to compute how long to defer `advanceProgressionPlayback` so the
  // visual chord swap aligns with the audio onset (`time - immediate()`).
  // The default mock has both pointing at the same `contextNowRef`, which
  // models a 0-lookahead scenario (existing tests rely on this). Tests
  // that want to exercise the lookahead-deferral path can override
  // `scheduleOnce` to fire early and pass a future `time`.
  const getContext = vi.fn(() => ({
    now: () => contextNowRef.fn(),
    immediate: () => contextNowRef.fn(),
  }));
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

// Tone Transport's scheduleOnce callback fires `lookAheadSec` BEFORE the
// precise audio time (Tone's default lookAhead is 0.1s; the callback's
// `time` arg is the audio-precise scheduled moment, and `rawContext.
// currentTime` at call time is `time - lookAhead`). This helper lets a
// single test swap in that behavior so the lookahead-deferral path can
// be exercised without changing the other tests' baseline.
function installToneLookaheadOnce(lookAheadSec: number) {
  toneMocks.scheduleOnce.mockImplementationOnce((cb, time) => {
    if (typeof time !== "string" || !time.startsWith("+")) {
      throw new Error("installToneLookaheadOnce: expected relative-time string");
    }
    const delaySec = Math.max(0, parseFloat(time.slice(1)));
    const earlyFireMs = Math.max(0, (delaySec - lookAheadSec) * 1000);
    const audioTime = toneMocks.contextNowRef.fn() + delaySec;
    setTimeout(() => cb(audioTime), earlyFireMs);
    return 999;
  });
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    toneMocks.transport.start.mockClear();
    toneMocks.transport.stop.mockClear();

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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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
      [scaleNameAtom, "major"],
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

  it("arms advance via Transport.scheduleOnce with a relative-time seconds string", () => {
    const tempoBpm = 60; // 1 beat = 1.0s
    const stepDurationSec = 1.0;
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, tempoBpm],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    // Timeline armed at audio start time 0, duration 1s.
    setActiveStep(0, 0, stepDurationSec, 0, 10);

    renderWithStore(<PlaybackLoopHarness />, store);

    expect(toneMocks.scheduleOnce).toHaveBeenCalledTimes(1);
    const [callback, timeArg] = toneMocks.scheduleOnce.mock.calls[0];
    expect(typeof callback).toBe("function");
    // Hook passes "+<seconds>" relative-time string; remaining = 1s.
    expect(typeof timeArg).toBe("string");
    expect((timeArg as string).startsWith("+")).toBe(true);
    expect(parseFloat((timeArg as string).slice(1))).toBeCloseTo(1.0, 2);
  });

  it("starts Transport when the audio-clock branch arms, and does NOT stop it on cleanup", () => {
    const tempoBpm = 60;
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, tempoBpm],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    setActiveStep(0, 0, 1.0, 0, 10);

    const { unmount } = renderWithStore(<PlaybackLoopHarness />, store);

    // Transport.start must run before scheduleOnce, otherwise the tick
    // source never advances and the callback never fires.
    expect(toneMocks.transport.start).toHaveBeenCalledTimes(1);
    expect(toneMocks.transport.stop).not.toHaveBeenCalled();

    unmount();

    // Transport is a shared singleton — stop ownership belongs to a future
    // top-level "all playback ended" path, NOT this hook (which unmounts on
    // every pause/mute toggle and would otherwise rewind future drum loops).
    expect(toneMocks.transport.stop).not.toHaveBeenCalled();
  });

  it("clears the scheduled callback on effect cleanup", () => {
    const tempoBpm = 60;
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
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

  it("defers the React advance to the audio-precise time so the chord overlay aligns with the audio (Tone lookahead compensation)", () => {
    // Simulate Tone Transport's lookahead: the callback fires ~100ms BEFORE
    // the audio time, with `time` arg = the precise audio moment. Without
    // the deferral, advance() would run immediately and the chord overlay
    // swap would visibly lead the audio by 100ms. With the deferral, the
    // Jotai write is delayed until rawContext.currentTime ≈ time.
    const lookAheadSec = 0.1;
    const tempoBpm = 60; // 1 beat = 1.0s
    installToneLookaheadOnce(lookAheadSec);

    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeChordProgression],
      [progressionTempoBpmAtom, tempoBpm],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    setActiveStep(0, 0, 1.0, 0, 10);

    renderWithStore(<PlaybackLoopHarness />, store);
    expect(store.get(chordRootAtom)).toBe("C");

    // Fast-forward to the Tone-early-fire moment (900ms in). The Transport
    // callback fires, but the advance must STILL be pending — deferred by
    // the ~100ms lookahead delta.
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(store.get(chordRootAtom)).toBe("C");

    // Fast-forward the remaining 100ms. The deferred setTimeout fires and
    // the React state finally swaps to the next chord, matching the audio.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(store.get(chordRootAtom)).toBe("G");
  });

  // Regression guard for the 2026-05-25 progression-stall bug. Wrapping the
  // advance in `Tone.Draw.schedule(...)` or `startTransition(...)` re-creates
  // the failure mode where the chain dies after a couple of bars: Draw
  // silently drops events whose scheduled time is >250ms in the past, and
  // `startTransition` gives React explicit permission to deprioritize the
  // Jotai write that arms the next step. Together they stall playback as
  // soon as one heavy Fretboard render slips past the 250ms window.
  it("does NOT wrap advanceProgressionPlayback in Tone.Draw or startTransition", () => {
    const rawSource = readFileSync(
      resolve(process.cwd(), "src/hooks/useProgressionPlaybackLoop.ts"),
      "utf8",
    );
    // Strip comments so the regression-warning comment block in the source
    // (which mentions Draw and startTransition by name) doesn't trip the
    // checks below. We only want to catch real imports / call sites.
    const code = rawSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(code, "Draw.schedule wrapper around advance re-introduces 250ms-expiration stall")
      .not.toMatch(/Draw\.schedule/);
    expect(code, "startTransition around advance defers Jotai write that arms next step")
      .not.toMatch(/\bstartTransition\b/);
    expect(code, "Tone's Draw import implies intent to use the dropped-when-stale path")
      .not.toMatch(/from\s+["']tone["'][^;]*\bDraw\b/);
  });
});
