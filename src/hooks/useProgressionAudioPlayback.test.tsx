// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../test-utils/renderWithAtoms";
import { isMutedAtom } from "../store/audioAtoms";
import { chordRootAtom } from "../store/chordOverlayAtoms";
import {
  beatsPerBarAtom,
  displayedStepIndexPrimitiveAtom,
  progressionBassEnabledAtom,
  progressionChordEnabledAtom,
  progressionDrumsEnabledAtom,
  progressionLoopEnabledAtom,
  progressionMetronomeEnabledAtom,
  progressionPlaybackLoadingAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../store/scaleAtoms";

// visualClock mocks: spy on startVisualClock / stopVisualClock.
const visualClockMocks = vi.hoisted(() => ({
  startVisualClock: vi.fn(),
  stopVisualClock: vi.fn(),
}));
vi.mock("../progressions/audio/visualClock", () => ({
  startVisualClock: visualClockMocks.startVisualClock,
  stopVisualClock: visualClockMocks.stopVisualClock,
}));

// Tone mocks: capture all Parts and Loops constructed; expose for assertions.
const toneMocks = vi.hoisted(() => {
  const contextNowRef = { fn: () => 0 };
  type Cb = (time: number, value: unknown) => void;
  interface PartInstance {
    tag: "part";
    callback: Cb;
    events: Array<[number, unknown]>;
    loop: boolean;
    loopEnd: number;
    startedTime: number | null;
    startedOffset: number | null;
    disposed: boolean;
    start(t?: number, o?: number): PartInstance;
    stop(): PartInstance;
    dispose(): PartInstance;
  }
  interface LoopInstance {
    tag: "loop";
    callback: (t: number) => void;
    interval: string | number;
    startedTime: number | null;
    disposed: boolean;
    start(t?: number): LoopInstance;
    dispose(): LoopInstance;
  }
  const parts: PartInstance[] = [];
  const loops: LoopInstance[] = [];

  function PartCtor(callback: Cb, events: Array<[number, unknown]>): PartInstance {
    const inst: PartInstance = {
      tag: "part",
      callback,
      events: [...events],
      loop: false,
      loopEnd: 0,
      startedTime: null,
      startedOffset: null,
      disposed: false,
      start(t?: number, o?: number) {
        this.startedTime = t ?? 0;
        this.startedOffset = o ?? 0;
        return this;
      },
      stop() {
        return this;
      },
      dispose() {
        this.disposed = true;
        return this;
      },
    };
    parts.push(inst);
    return inst;
  }
  function LoopCtor(callback: (t: number) => void, interval: string | number): LoopInstance {
    const inst: LoopInstance = {
      tag: "loop",
      callback,
      interval,
      startedTime: null,
      disposed: false,
      start(t?: number) {
        this.startedTime = t ?? 0;
        return this;
      },
      dispose() {
        this.disposed = true;
        return this;
      },
    };
    loops.push(inst);
    return inst;
  }

  const transport = {
    scheduleOnce: vi.fn(),
    clear: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    bpm: { value: 120 },
    seconds: 0,
    swing: 0,
    timeSignature: 4,
  };

  // Default schedule impl fires the callback synchronously so tests observe
  // the deferred Jotai write without juggling rAF or fake timers.
  const drawSchedule = vi.fn((cb: () => void) => {
    cb();
  });
  const drawCancel = vi.fn();
  const draw = { expiration: 5, schedule: drawSchedule, cancel: drawCancel };

  class FakeAudioNode {
    input: FakeAudioNode = this;
    connect() { return this; }
    disconnect() { return this; }
    dispose() {}
  }
  class FakeReverb extends FakeAudioNode {
    generate() { return Promise.resolve(this); }
  }

  return {
    contextNowRef,
    parts,
    loops,
    Part: PartCtor as unknown as new (...args: unknown[]) => unknown,
    Loop: LoopCtor as unknown as new (...args: unknown[]) => unknown,
    getTransport: vi.fn(() => transport),
    getDraw: vi.fn(() => draw),
    getContext: vi.fn(() => ({
      now: () => contextNowRef.fn(),
      immediate: () => contextNowRef.fn(),
    })),
    now: vi.fn(() => contextNowRef.fn()),
    setContext: vi.fn(),
    transport,
    drawSchedule,
    drawCancel,
    FakeAudioNode,
    FakeReverb,
  };
});
vi.mock("tone", () => ({
  Part: toneMocks.Part,
  Loop: toneMocks.Loop,
  getTransport: toneMocks.getTransport,
  getDraw: toneMocks.getDraw,
  getContext: toneMocks.getContext,
  now: toneMocks.now,
  setContext: toneMocks.setContext,
  Channel: toneMocks.FakeAudioNode,
  Compressor: toneMocks.FakeAudioNode,
  Limiter: toneMocks.FakeAudioNode,
  Gain: toneMocks.FakeAudioNode,
  EQ3: toneMocks.FakeAudioNode,
  Chebyshev: toneMocks.FakeAudioNode,
  Distortion: toneMocks.FakeAudioNode,
  Freeverb: toneMocks.FakeAudioNode,
  JCReverb: toneMocks.FakeAudioNode,
  Reverb: toneMocks.FakeReverb,
  // Tone's native↔Tone connect bridge used by materializeSignalGraph.
  connect: () => {},
}));

import { _resetProgressionAudioForTests, ensureProgressionAudio } from "../progressions/audio/bus";
import { _resetTimelineForTests } from "../progressions/audio/timeline";
import {
  __resetProgressionAudioPlaybackForTests,
  useProgressionAudioPlayback,
} from "./useProgressionAudioPlayback";

function Harness() {
  useProgressionAudioPlayback();
  return null;
}

const threeBars = [
  { id: "1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "2", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "3", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
] as const;

describe("useProgressionAudioPlayback (tone-native orchestrator)", () => {
  // Warm the lazily dynamic-imported audio engine once, up front. Without this
  // the FIRST test alone pays the module-compile cost; under parallel-CI CPU
  // contention that pushed it past vi.waitFor's 1000ms default and flaked
  // ("expected [] to have a length of 5"). Pre-loading levels every test to the
  // same warm baseline as the (stable) rest. The hook's getEngine() reset in
  // beforeEach still re-imports, but now resolves instantly from the module cache.
  beforeAll(async () => {
    await import("../progressions/audio/progressionAudioEngine");
  });

  beforeEach(() => {
    __resetProgressionAudioPlaybackForTests();
    localStorage.clear();
    toneMocks.parts.length = 0;
    toneMocks.loops.length = 0;
    toneMocks.drawSchedule.mockClear();
    toneMocks.drawCancel.mockClear();
    toneMocks.transport.scheduleOnce.mockReset();
    toneMocks.transport.clear.mockReset();
    toneMocks.transport.stop.mockClear();
    toneMocks.transport.seconds = 0;
    _resetTimelineForTests();
    _resetProgressionAudioForTests();
    const audioContext = {
      currentTime: 0,
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
    toneMocks.contextNowRef.fn = () => audioContext.currentTime;
    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () {
        return audioContext;
      }) as unknown as typeof AudioContext;
  });

  it("schedules the metronome as a 5th Tone.Part (not a Tone.Loop)", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      // 5 Parts: chord-onset, chord-strum, bass, drums, metronome.
      expect(toneMocks.parts).toHaveLength(5);
      expect(toneMocks.loops).toHaveLength(0);
    });
  });

  it("metronome Part loopEnd matches totalDurationSec (loops in sync with chord parts)", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 3], // 3/4 time
      [progressionLoopEnabledAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    await vi.waitFor(() => {
      expect(toneMocks.parts).toHaveLength(5);
    });
    // Every Part's loopEnd equals totalDurationSec = 3 bars × 3 beats × 1 sec/beat = 9
    toneMocks.parts.forEach((p) => {
      expect(p.loopEnd).toBe(9);
    });
  });

  it("sets loop=true + loopEnd=totalDurationSec on every Part when progressionLoopEnabled is on", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [progressionLoopEnabledAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });
    toneMocks.parts.forEach((p) => {
      expect(p.loop).toBe(true);
      expect(p.loopEnd).toBe(12); // 3 bars * 4 beats/bar * 1 sec/beat
    });
  });

  it("advances chordRootAtom when the chord-onset Part fires on first-bar events only", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    // Wait for the dynamic import to resolve and Parts to be built.
    let onsets: (typeof toneMocks.parts)[number] | undefined;
    await vi.waitFor(() => {
      onsets = toneMocks.parts.find(
        (p) =>
          p.events.length === 3
          && (p.events[0][1] as { isFirstBar?: boolean }).isFirstBar === true,
      );
      expect(onsets).toBeDefined();
    });
    expect(store.get(chordRootAtom)).toBe("C");

    // Fire chord-onset event for step 1 (G). The orchestrator defers the
    // Jotai write through Tone.Draw.schedule(cb, audioTime); the mock fires
    // the callback synchronously so we can observe the state advance here.
    // Also advance displayedStepIndexPrimitiveAtom to simulate the visual
    // clock (RAF) that would run in real playback alongside the audio clock.
    const audioTime = toneMocks.contextNowRef.fn() + 0.1;
    act(() => {
      onsets!.callback(audioTime, onsets!.events[1][1]);
      store.set(displayedStepIndexPrimitiveAtom, 1);
    });
    expect(toneMocks.drawSchedule).toHaveBeenCalledWith(expect.any(Function), audioTime);
    expect(store.get(chordRootAtom)).toBe("G");
  });

  // Regression guard for the 2026-05-25 P2-T2 swap (setTimeout → Tone.Draw).
  // Pairs with the bus.ts guard that locks Draw.expiration to 5s; together
  // they prevent a regression to the 3fa9ce5 stall (0.25s default expiration
  // silently dropping the advance under heavy main-thread load).
  it("defers chord-overlay advance via Tone.Draw.schedule", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    // Wait for Parts to be built.
    await vi.waitFor(() => {
      expect(toneMocks.parts).toHaveLength(5);
    });

    // Find the chord-onset Part — the one whose events carry `isFirstBar`.
    const onsetPart = toneMocks.parts.find(
      (p) =>
        p.events.length > 0
        && (p.events[0][1] as { isFirstBar?: boolean }).isFirstBar !== undefined,
    );
    expect(onsetPart).toBeDefined();

    toneMocks.drawSchedule.mockClear();

    // Invoke the chord-onset callback for a first-bar event.
    const firstBar = onsetPart!.events.find(
      ([, v]) => (v as { isFirstBar?: boolean }).isFirstBar === true,
    );
    expect(firstBar).toBeDefined();
    const audioTime = toneMocks.contextNowRef.fn() + 0.1;
    act(() => {
      onsetPart!.callback(audioTime, firstBar![1]);
    });

    // The chord-overlay advance should have been deferred through Draw.schedule.
    expect(toneMocks.drawSchedule).toHaveBeenCalledWith(
      expect.any(Function),
      audioTime,
    );
  });

  it("disposes ALL primitives and rebuilds from 0 when steps change mid-play", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });
    const initialParts = [...toneMocks.parts];
    const initialLoops = [...toneMocks.loops];

    act(() => {
      store.set(progressionStepsAtom, [
        ...threeBars,
        { id: "4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
    });

    await vi.waitFor(() => {
      initialParts.forEach((p) => expect(p.disposed).toBe(true));
      initialLoops.forEach((l) => expect(l.disposed).toBe(true));
      expect(toneMocks.parts.length).toBeGreaterThan(initialParts.length);
    });
    // New Part starts at offset 0 (restart from bar 0 on edit).
    const newOnsets = toneMocks.parts
      .slice(initialParts.length)
      .find((p) => p.events.length === 4);
    expect(newOnsets?.startedOffset).toBe(0);
  });

  it("restarts from bar 1 (offset 0) up front WITHOUT rewinding the running transport", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });
    const initialParts = [...toneMocks.parts];

    // Clear the transport.stop spy so we measure only the upcoming change.
    toneMocks.transport.stop.mockClear();

    act(() => {
      store.set(progressionStepsAtom, [
        ...threeBars,
        { id: "4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
    });

    // Old parts are disposed up front so the old audio is silenced immediately
    // (deterministic switch — no make-before-break overlap).
    initialParts.forEach((p) => expect(p.disposed).toBe(true));
    // The transport must NOT be stopped/rewound. Parts are scheduled at an
    // absolute AudioContext time (partStart = ctx.currentTime + lead) and the
    // transport runs continuously, so its position tracks that clock. Rewinding
    // it to 0 leaves the freshly-built parts scheduled far in the future, so
    // playback goes silent and never restarts (regression guard for the
    // genre-switch freeze).
    expect(toneMocks.transport.stop).not.toHaveBeenCalled();

    // The async rebuild then constructs a fresh set of Parts starting at offset 0.
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(initialParts.length);
    });
    const newOnsets = toneMocks.parts
      .slice(initialParts.length)
      .find((p) => p.events.length === 4);
    expect(newOnsets?.startedOffset).toBe(0);
  });

  it("tempo change is a LIVE update (Transport.bpm.value); no new Parts constructed", async () => {
    // Sentinel: pre-load mock bpm to a value neither effect should leave
    // behind, so we can prove BOTH the initial-render AND the post-change
    // settings of bpm.value came from the live effect.
    toneMocks.transport.bpm.value = 999;

    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    // Wait for dynamic import so engine is set (Effect 2 guards behind engine).
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });

    // After initial render: live effect should have applied the atom value.
    expect(toneMocks.transport.bpm.value).toBe(60);
    const before = toneMocks.parts.length;

    act(() => {
      store.set(progressionTempoBpmAtom, 120);
    });

    expect(toneMocks.parts.length).toBe(before); // no new Parts
    expect(toneMocks.transport.bpm.value).toBe(120); // setter fired again
    toneMocks.parts.forEach((p) => expect(p.disposed).toBe(false));
  });

  it("loop toggle is a LIVE update (no rebuild) — flips every Part's loop flag in place", async () => {
    // Tone.Part.loop is a live setter, exposed via our handle's setLoop.
    // Toggling loop mid-play must NOT dispose Parts (which would restart
    // playback at bar 0 with an audible glitch).
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [progressionLoopEnabledAtom, false],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBe(5);
    });
    const initialParts = [...toneMocks.parts];
    initialParts.forEach((p) => expect(p.loop).toBe(false));

    act(() => {
      store.set(progressionLoopEnabledAtom, true);
    });

    // No rebuild: same Part instances, none disposed, no new constructions.
    expect(toneMocks.parts).toHaveLength(initialParts.length);
    initialParts.forEach((p) => expect(p.disposed).toBe(false));
    // All Parts now report loop=true with loopEnd = total duration (12s).
    initialParts.forEach((p) => {
      expect(p.loop).toBe(true);
      expect(p.loopEnd).toBe(12);
    });
  });

  it("loop OFF → ON cancels the pending end-event scheduled at build time", async () => {
    // Build-time end-event id sentinel.
    toneMocks.transport.scheduleOnce.mockReturnValueOnce(7777);
    toneMocks.transport.clear.mockClear();

    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [progressionLoopEnabledAtom, false],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    // Wait for engine to be available and build to complete.
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });

    // Build path scheduled the end-event since loop=false.
    expect(toneMocks.transport.scheduleOnce).toHaveBeenCalledTimes(1);

    act(() => {
      store.set(progressionLoopEnabledAtom, true);
    });

    // Effect 7 must clear the pending end-event so playback doesn't stop
    // at the original natural end.
    expect(toneMocks.transport.clear).toHaveBeenCalledWith(7777);
  });

  it("loop ON → OFF schedules a new end-event at the natural loop end", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [progressionLoopEnabledAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });

    // Loop=true at build time: no end-event scheduled.
    expect(toneMocks.transport.scheduleOnce).not.toHaveBeenCalled();

    // Simulate transport mid-loop (3s into a 12s loop → 9s remaining).
    toneMocks.transport.seconds = 3;

    act(() => {
      store.set(progressionLoopEnabledAtom, false);
    });

    // Effect 7 schedules a new end-event for the remaining loop time.
    expect(toneMocks.transport.scheduleOnce).toHaveBeenCalledTimes(1);
    const [, when] = toneMocks.transport.scheduleOnce.mock.calls[0];
    expect(typeof when).toBe("string");
    // "+<positive number>" — 9s remaining + 0.05s lead = 9.05s.
    expect(when).toMatch(/^\+\d+(\.\d+)?$/);
    const seconds = Number(String(when).slice(1));
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(12 + 0.1);
  });

  it("toggling drums flips the layer gain without rebuilding primitives", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [progressionDrumsEnabledAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });
    const before = [...toneMocks.parts];

    act(() => {
      store.set(progressionDrumsEnabledAtom, false);
    });

    // No new Parts, no disposals.
    expect(toneMocks.parts).toHaveLength(before.length);
    before.forEach((p) => expect(p.disposed).toBe(false));
    // Only verify the rebuild guard didn't fire.
  });

  it("applies the current track-button mute state when playback starts", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [progressionDrumsEnabledAtom, false],
      [progressionLoopEnabledAtom, true],
      [isMutedAtom, false],
    ]);
    store.set(setProgressionPlayingAtom, true);
    store.set(progressionChordEnabledAtom, false);
    store.set(progressionBassEnabledAtom, false);
    store.set(progressionMetronomeEnabledAtom, false);
    renderWithStore(<Harness />, store);

    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });

    const audio = ensureProgressionAudio();
    expect(audio).not.toBeNull();
    expect(audio!.layers.chord.gain.value).toBe(0);
    expect(audio!.layers.bass.gain.value).toBe(0);
    expect(audio!.layers.drums.gain.value).toBe(0);
    expect(audio!.layers.metronome.gain.value).toBe(0);
  });

  it("disposes everything on pause", async () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });
    expect(toneMocks.parts.every((p) => !p.disposed)).toBe(true);

    act(() => {
      store.set(setProgressionPlayingAtom, false);
    });

    toneMocks.parts.forEach((p) => expect(p.disposed).toBe(true));
    toneMocks.loops.forEach((l) => expect(l.disposed).toBe(true));
  });

  it("does not build any primitives while muted", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
      [isMutedAtom, true],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts).toHaveLength(0);
    expect(toneMocks.loops).toHaveLength(0);
  });

  describe("error handling", () => {
    it("clears loading state when buildAllLayersAsync throws", async () => {
      // Force buildAllLayersAsync to reject by spying on the shared module
      // instance (Vitest module registry is shared between host and dynamic
      // imports, so the spy affects the hook's internal call).
      const buildMod = await import("../progressions/audio/buildAllLayers");
      const spy = vi
        .spyOn(buildMod, "buildAllLayersAsync")
        .mockRejectedValueOnce(new Error("build failed (test-injected)"));

      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "major"],
        [progressionStepsAtom, threeBars],
        [progressionTempoBpmAtom, 60],
        [beatsPerBarAtom, 4],
      ]);
      store.set(setProgressionPlayingAtom, true);
      renderWithStore(<Harness />, store);

      // loading goes true synchronously when the effect fires.
      expect(store.get(progressionPlaybackLoadingAtom)).toBe(true);

      // After buildAllLayersAsync rejects, loading must return to false.
      await vi.waitFor(() => {
        expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
      });

      spy.mockRestore();
    });
  });

  describe("visual clock lifecycle", () => {
    beforeEach(() => {
      visualClockMocks.startVisualClock.mockClear();
      visualClockMocks.stopVisualClock.mockClear();
    });

    it("starts visual clock on playback and stops it on teardown", async () => {
      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "major"],
        [progressionStepsAtom, threeBars],
        [progressionTempoBpmAtom, 60],
        [beatsPerBarAtom, 4],
      ]);
      store.set(setProgressionPlayingAtom, true);
      const { unmount } = renderWithStore(<Harness />, store);

      // Wait for the engine to build (Parts appear after dynamic import).
      await vi.waitFor(() => {
        expect(toneMocks.parts.length).toBeGreaterThan(0);
      });

      // startVisualClock should have been called with the store.
      expect(visualClockMocks.startVisualClock).toHaveBeenCalledWith(store);

      unmount();

      // stopVisualClock should have been called on teardown.
      expect(visualClockMocks.stopVisualClock).toHaveBeenCalled();
    });
  });

  describe("progressionPlaybackLoadingAtom integration", () => {
    it("flips loading true at Effect 1 build entry, false on first chord-onset", async () => {
      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "major"],
        [progressionStepsAtom, threeBars],
        [progressionTempoBpmAtom, 60],
        [beatsPerBarAtom, 4],
      ]);
      store.set(setProgressionPlayingAtom, true);
      renderWithStore(<Harness />, store);

      // After Effect 1 starts async load: loading is true via setLoading(true).
      expect(store.get(progressionPlaybackLoadingAtom)).toBe(true);

      // Wait until Parts are built, then find the chord-onset Part.
      await vi.waitFor(() => {
        const found = toneMocks.parts.find(
          (p) =>
            p.events.length === 3
            && (p.events[0][1] as { isFirstBar?: boolean }).isFirstBar === true,
        );
        expect(found).toBeDefined();
      });
      const onsets = toneMocks.parts.find(
        (p) =>
          p.events.length === 3
          && (p.events[0][1] as { isFirstBar?: boolean }).isFirstBar === true,
      );

      // Fire first chord-onset — loading should flip to false.
      const audioTime = toneMocks.contextNowRef.fn() + 0.1;
      act(() => {
        onsets!.callback(audioTime, onsets!.events[0][1]);
      });
      expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);

      // Subsequent callbacks should keep it false (no flip back).
      act(() => {
        onsets!.callback(audioTime + 4, onsets!.events[1][1]);
      });
      expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
    });

    it("clears loading when playback stops mid-load", async () => {
      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "major"],
        [progressionStepsAtom, threeBars],
        [progressionTempoBpmAtom, 60],
        [beatsPerBarAtom, 4],
      ]);
      store.set(setProgressionPlayingAtom, true);
      renderWithStore(<Harness />, store);

      // loading is set true synchronously by the effect before the async engine loads
      expect(store.get(progressionPlaybackLoadingAtom)).toBe(true);

      // Stop without ever firing the chord-onset callback.
      act(() => {
        store.set(setProgressionPlayingAtom, false);
      });

      // waitFor because the cleanup path runs after the dynamic import resolves.
      await vi.waitFor(() => {
        expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
      });
    });

    it("clears loading when muted toggles true while loading", async () => {
      const store = makeAtomStore([
        [rootNoteAtom, "C"],
        [scaleNameAtom, "major"],
        [progressionStepsAtom, threeBars],
        [progressionTempoBpmAtom, 60],
        [beatsPerBarAtom, 4],
      ]);
      store.set(setProgressionPlayingAtom, true);
      renderWithStore(<Harness />, store);
      expect(store.get(progressionPlaybackLoadingAtom)).toBe(true);

      act(() => {
        store.set(isMutedAtom, true);
      });

      await vi.waitFor(() => {
        expect(store.get(progressionPlaybackLoadingAtom)).toBe(false);
      });
    });
  });

  it("eagerly compiles backing track audio layers during idle time and uses the cached value on Play", async () => {
    const buildMod = await import("../progressions/audio/buildAllLayers");
    const spy = vi.spyOn(buildMod, "buildAllLayersAsync");

    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);

    // Render hook while NOT playing (idle).
    renderWithStore(<Harness />, store);

    // Wait for the background compilation to complete.
    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });

    // Clear call history on spy.
    spy.mockClear();

    // Start playing. The playback effect should start immediately
    // and consume the cached compilation value without calling buildAllLayersAsync again.
    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    // Wait for parts to be built.
    await vi.waitFor(() => {
      expect(toneMocks.parts.length).toBeGreaterThan(0);
    });

    // Since it was cached, buildAllLayersAsync should not have been called during transition to play!
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

});

