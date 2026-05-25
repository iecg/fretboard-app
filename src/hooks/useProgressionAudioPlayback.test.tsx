// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { makeAtomStore, renderWithStore } from "../test-utils/renderWithAtoms";
import { isMutedAtom } from "../store/audioAtoms";
import { chordRootAtom } from "../store/chordOverlayAtoms";
import {
  beatsPerBarAtom,
  progressionDrumsEnabledAtom,
  progressionLoopEnabledAtom,
  progressionStepsAtom,
  progressionTempoBpmAtom,
  setProgressionPlayingAtom,
} from "../store/progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "../store/scaleAtoms";

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

  return {
    contextNowRef,
    parts,
    loops,
    Part: PartCtor as unknown as new (...args: unknown[]) => unknown,
    Loop: LoopCtor as unknown as new (...args: unknown[]) => unknown,
    getTransport: vi.fn(() => transport),
    getContext: vi.fn(() => ({
      now: () => contextNowRef.fn(),
      immediate: () => contextNowRef.fn(),
    })),
    now: vi.fn(() => contextNowRef.fn()),
    setContext: vi.fn(),
    transport,
  };
});
vi.mock("tone", () => ({
  Part: toneMocks.Part,
  Loop: toneMocks.Loop,
  getTransport: toneMocks.getTransport,
  getContext: toneMocks.getContext,
  now: toneMocks.now,
  setContext: toneMocks.setContext,
}));

import { _resetProgressionAudioForTests } from "../progressions/audio/bus";
import { _resetTimelineForTests } from "../progressions/audio/timeline";
import { useProgressionAudioPlayback } from "./useProgressionAudioPlayback";

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    localStorage.clear();
    toneMocks.parts.length = 0;
    toneMocks.loops.length = 0;
    _resetTimelineForTests();
    _resetProgressionAudioForTests();
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
    toneMocks.contextNowRef.fn = () => audioContext.currentTime;
    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () {
        return audioContext;
      }) as unknown as typeof AudioContext;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructs 4 Parts (chord-onsets + strums + bass + drums) and 1 Loop (metronome) on play start", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    expect(toneMocks.parts).toHaveLength(4);
    expect(toneMocks.loops).toHaveLength(1);
  });

  it("sets loop=true + loopEnd=totalDurationSec on every Part when progressionLoopEnabled is on", () => {
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
    toneMocks.parts.forEach((p) => {
      expect(p.loop).toBe(true);
      expect(p.loopEnd).toBe(12); // 3 bars * 4 beats/bar * 1 sec/beat
    });
  });

  it("advances chordRootAtom when the chord-onset Part fires on first-bar events only", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);

    // Find the chord-onset Part by checking which Part has 3 events (one per
    // 1-bar step). Drum Part has many more events.
    const onsets = toneMocks.parts.find(
      (p) =>
        p.events.length === 3
        && (p.events[0][1] as { isFirstBar?: boolean }).isFirstBar === true,
    );
    expect(onsets).toBeDefined();
    expect(store.get(chordRootAtom)).toBe("C");

    // Fire chord-onset event for step 1 (G). Pass audioTime = "now" so the
    // production code's lookahead delta `audioTime - immediate()` collapses
    // to 0 and the Jotai write isn't deferred behind fake timers. This
    // mirrors what Tone does in real playback when context.currentTime
    // catches up to the scheduled event's time.
    act(() => {
      onsets!.callback(toneMocks.contextNowRef.fn(), onsets!.events[1][1]);
    });
    expect(store.get(chordRootAtom)).toBe("G");
  });

  it("disposes ALL primitives and rebuilds from 0 when steps change mid-play", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
    const initialParts = [...toneMocks.parts];
    const initialLoops = [...toneMocks.loops];

    act(() => {
      store.set(progressionStepsAtom, [
        ...threeBars,
        { id: "4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ]);
    });

    initialParts.forEach((p) => expect(p.disposed).toBe(true));
    initialLoops.forEach((l) => expect(l.disposed).toBe(true));
    expect(toneMocks.parts.length).toBeGreaterThan(initialParts.length);
    // New Part starts at offset 0 (restart from bar 0 on edit).
    const newOnsets = toneMocks.parts
      .slice(initialParts.length)
      .find((p) => p.events.length === 4);
    expect(newOnsets?.startedOffset).toBe(0);
  });

  it("tempo change is a LIVE update (Transport.bpm.value); no new Parts constructed", () => {
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

  it("loop toggle is a LIVE update (part.setLoop); no new Parts constructed", () => {
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
    const before = toneMocks.parts.length;
    toneMocks.parts.forEach((p) => expect(p.loop).toBe(false));

    act(() => {
      store.set(progressionLoopEnabledAtom, true);
    });

    expect(toneMocks.parts.length).toBe(before);
    toneMocks.parts.forEach((p) => expect(p.loop).toBe(true));
  });

  it("toggling drums flips the layer gain without rebuilding primitives", () => {
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
    const before = [...toneMocks.parts];

    act(() => {
      store.set(progressionDrumsEnabledAtom, false);
    });

    // No new Parts, no disposals.
    expect(toneMocks.parts).toHaveLength(before.length);
    before.forEach((p) => expect(p.disposed).toBe(false));
    // Gain side-effect is verified by the layerBuses test in Task 1 — here we
    // only verify the rebuild guard didn't fire.
  });

  it("disposes everything on pause", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, threeBars],
      [progressionTempoBpmAtom, 60],
      [beatsPerBarAtom, 4],
    ]);
    store.set(setProgressionPlayingAtom, true);
    renderWithStore(<Harness />, store);
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

  // Regression guard for the 2026-05-25 progression-stall bug.
  it("does NOT wrap advanceProgressionPlayback in Tone.Draw or startTransition", () => {
    const raw = readFileSync(
      resolve(process.cwd(), "src/hooks/useProgressionAudioPlayback.ts"),
      "utf8",
    );
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(code).not.toMatch(/Draw\.schedule/);
    expect(code).not.toMatch(/\bstartTransition\b/);
    expect(code).not.toMatch(/from\s+["']tone["'][^;]*\bDraw\b/);
  });
});
