import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNoteFrequency } from "@fretflow/core";

// Mock the metronome module so the scheduler integration test can assert on
// `scheduleClick` calls directly instead of inspecting Web Audio nodes. The
// real metronome is built on Tone.Synth (see metronome.ts) and lives outside
// the `MockCtx` it would have used; we spy on the call surface that matters.
const scheduleClickSpy = vi.hoisted(() => vi.fn());
const cancelClickSpy = vi.hoisted(() => vi.fn());
vi.mock("./metronome", () => ({
  scheduleClick: scheduleClickSpy.mockImplementation(() => ({
    cancel: cancelClickSpy,
  })),
  _metronomeInternals: { ACCENT_FREQ: 1500, NORMAL_FREQ: 900, DECAY: 0.04 },
}));

// Same pattern for the bass voice — now Tone.MonoSynth-backed, so the raw
// `mock.oscillators()` counts no longer reflect bass activity. The spy
// captures (ctx, dest, frequency, time, options) per scheduleBassNote call
// and the cancel spy fires when the step handle tears down the lane.
const scheduleBassNoteSpy = vi.hoisted(() => vi.fn());
const cancelBassSpy = vi.hoisted(() => vi.fn());
vi.mock("./bass", () => ({
  scheduleBassNote: scheduleBassNoteSpy.mockImplementation(() => ({
    cancel: cancelBassSpy,
  })),
}));

import { scheduleProgressionStep } from "./scheduler";
import { _metronomeInternals } from "./metronome";
import {
  buildMockCtx as buildSharedMockCtx,
  createMockGain,
  type MockBufferSourceNode,
  type MockOscillatorNode,
} from "../../test-utils/mockWebAudio";

// Web Audio mock — counts node creations so tests can assert "drums scheduled
// X hits" without depending on real audio timing.

interface MockCtx {
  ctx: AudioContext;
  oscCount: () => number;
  bufferSourceCount: () => number;
  oscillators: () => MockOscillatorNode[];
  bufferSources: () => MockBufferSourceNode[];
}

function buildMockCtx(): MockCtx {
  const ctx = buildSharedMockCtx();
  return {
    ctx: ctx as unknown as AudioContext,
    oscCount: () => ctx.created.oscillators.length,
    bufferSourceCount: () => ctx.created.bufferSources.length,
    oscillators: () => ctx.created.oscillators,
    bufferSources: () => ctx.created.bufferSources,
  };
}

// Default catalog-driven fields that reproduce the OLD hardcoded behavior:
// strum voice + pop-8ths (== POP_STRUM_PATTERN), root-fifth bass, rock drums,
// no swing, no variations. Spread into every step input so existing
// assertions about hit counts / timing remain valid.
const defaultNewFields = {
  chordInstrument: "strum" as const,
  chordPatternId: "pop-8ths",
  bassPatternId: "root-fifth",
  drumPatternId: "rock",
  drumVariations: [] as string[],
  swing: 0,
};

describe("scheduleProgressionStep", () => {
  let bus: ReturnType<typeof createMockGain>;
  let mock: MockCtx;

  beforeEach(() => {
    mock = buildMockCtx();
    bus = createMockGain();
    cancelClickSpy.mockReset();
    scheduleClickSpy.mockReset().mockImplementation(() => ({
      cancel: cancelClickSpy,
    }));
    cancelBassSpy.mockReset();
    scheduleBassNoteSpy.mockReset().mockImplementation(() => ({
      cancel: cancelBassSpy,
    }));
  });

  it("returns a no-op handle when beatsAvailable is 0", () => {
    const handle = scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: ["C3"],
      bassNotes: ["C2"],
      beatsAvailable: 0,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: true, drums: true, metronome: true },
      ...defaultNewFields,
    });
    expect(mock.oscCount()).toBe(0);
    expect(() => handle.cancelAll()).not.toThrow();
  });

  it("returns a no-op handle when beatsPerBar is 0", () => {
    const handle = scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: ["C3"],
      bassNotes: ["C2"],
      beatsAvailable: 4,
      beatsPerBar: 0,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: true, drums: true, metronome: true },
      ...defaultNewFields,
    });
    expect(mock.oscCount()).toBe(0);
    expect(() => handle.cancelAll()).not.toThrow();
  });

  it("returns a no-op handle when beatsPerBar is negative", () => {
    const handle = scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: ["C3"],
      bassNotes: ["C2"],
      beatsAvailable: 4,
      beatsPerBar: -4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: true, drums: true, metronome: true },
      ...defaultNewFields,
    });
    expect(mock.oscCount()).toBe(0);
    expect(() => handle.cancelAll()).not.toThrow();
  });

  it("does not schedule any oscillators when all flags are off", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: ["C3", "E3", "G3"],
      bassNotes: ["C2"],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: false, drums: false, metronome: false },
      ...defaultNewFields,
    });
    expect(mock.oscCount()).toBe(0);
    expect(mock.bufferSourceCount()).toBe(0);
  });

  it("schedules strum hits only when strum flag is on", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: ["C3", "E3", "G3"],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: false, drums: false, metronome: false },
      ...defaultNewFields,
    });
    // 6 strum hits × 3-note voicing = 18 oscillators.
    expect(mock.oscCount()).toBe(18);
  });

  it("schedules bass voices when bass flag is on", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: ["C2"],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: true, drums: false, metronome: false },
      ...defaultNewFields,
    });
    // Beats 0 and 2 = two bass hits. The bass voice is now Tone-backed,
    // so we inspect the scheduleBassNote spy rather than oscillator count.
    expect(scheduleBassNoteSpy).toHaveBeenCalledTimes(2);
    expect(mock.oscCount()).toBe(0);
  });

  it("uses the second bass note on beat 3 when available", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: ["C2", "G2"],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: true, drums: false, metronome: false },
      ...defaultNewFields,
    });

    // scheduleBassNote(ctx, dest, frequency, time, options) — pull frequency
    // and time off each call.
    expect(scheduleBassNoteSpy).toHaveBeenCalledTimes(2);
    const calls = scheduleBassNoteSpy.mock.calls.map((args) => [args[2], args[3]]);
    expect(calls).toEqual([
      [getNoteFrequency("C2"), 0],
      [getNoteFrequency("G2"), 1],
    ]);
  });

  it("cancels scheduled bass voices when the step handle is cancelled", () => {
    const handle = scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: ["C2", "G2"],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: true, drums: false, metronome: false },
      ...defaultNewFields,
    });

    expect(scheduleBassNoteSpy).toHaveBeenCalledTimes(2);
    expect(cancelBassSpy).not.toHaveBeenCalled();

    handle.cancelAll();

    // Each bass voice's cancel() should fire on step cancellation.
    expect(cancelBassSpy).toHaveBeenCalledTimes(2);
  });

  it("schedules metronome clicks (one per beat) only when flag is on", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: false, drums: false, metronome: true },
      ...defaultNewFields,
    });
    expect(scheduleClickSpy).toHaveBeenCalledTimes(4);
  });

  it("cancels scheduled metronome clicks when the step handle is cancelled", () => {
    const handle = scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 3,
      enable: { strum: false, bass: false, drums: false, metronome: true },
      ...defaultNewFields,
    });

    expect(scheduleClickSpy).toHaveBeenCalledTimes(4);
    expect(cancelClickSpy).not.toHaveBeenCalled();

    handle.cancelAll();

    // Each metronome voice's cancel() should fire on step cancellation.
    expect(cancelClickSpy).toHaveBeenCalledTimes(4);
  });

  it("keeps step timing but skips past hits when rescheduling from a cutoff", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 10,
      scheduleFromTime: 10.76,
      enable: { strum: false, bass: false, drums: false, metronome: true },
      ...defaultNewFields,
    });

    // scheduleClick(ctx, dest, time, options) — extract the `time` arg.
    const clickTimes = scheduleClickSpy.mock.calls.map((args) => args[2]);
    expect(clickTimes).toEqual([11, 11.5]);
  });

  it("uses buffer sources for the drum kit (kick adds oscillators, snare/hat add buffers)", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: false, drums: true, metronome: false },
      ...defaultNewFields,
    });
    // 2 kicks × (body + click) = 4 oscillators from kicks
    // 2 snares × (body) = 2 oscillators from snares
    // Total kick + snare body oscillators
    expect(mock.oscCount()).toBeGreaterThanOrEqual(6);
    // Snares + hats use noise buffers — at minimum 2 snares + 8 hats = 10.
    expect(mock.bufferSourceCount()).toBeGreaterThanOrEqual(10);
  });

  it("cancels scheduled drum hits when the step handle is cancelled", () => {
    const handle = scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 4,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 3,
      enable: { strum: false, bass: false, drums: true, metronome: false },
      ...defaultNewFields,
    });

    const scheduledSources = [
      ...mock.oscillators(),
      ...mock.bufferSources(),
    ];
    expect(scheduledSources.length).toBeGreaterThan(0);
    expect(scheduledSources.every((source) => source.stop.mock.calls.length === 1))
      .toBe(true);

    handle.cancelAll();

    expect(scheduledSources.every((source) => source.stop.mock.calls.length >= 2))
      .toBe(true);
  });

  it("clips strum hits past the available beats", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: ["C3"],
      bassNotes: [],
      beatsAvailable: 1, // only beat 0 of POP_STRUM_PATTERN qualifies
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: false, drums: false, metronome: false },
      ...defaultNewFields,
    });
    expect(mock.oscCount()).toBe(1);
  });

  it("repeats strum hits once per bar for multi-bar chords", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: ["C3"],
      bassNotes: [],
      beatsAvailable: 8,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: true, bass: false, drums: false, metronome: false },
      ...defaultNewFields,
    });
    expect(mock.oscCount()).toBe(12);
  });

  it("accents each bar downbeat when metronome repeats over multi-bar chords", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: [],
      beatsAvailable: 8,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: false, drums: false, metronome: true },
      ...defaultNewFields,
    });

    // scheduleClick(ctx, dest, time, { accent, velocity }) — pick `accent`
    // off each call and map back to the internal frequency for parity with
    // the prior assertion.
    const frequencies = scheduleClickSpy.mock.calls.map((args) =>
      args[3]?.accent ? _metronomeInternals.ACCENT_FREQ : _metronomeInternals.NORMAL_FREQ,
    );
    expect(frequencies).toEqual([
      _metronomeInternals.ACCENT_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.ACCENT_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.NORMAL_FREQ,
      _metronomeInternals.NORMAL_FREQ,
    ]);
  });

  it("repeats the root-fifth bass pattern once per bar for multi-bar chords", () => {
    scheduleProgressionStep(mock.ctx, bus as unknown as AudioNode, {
      voicing: [],
      bassNotes: ["C2", "G2"],
      beatsAvailable: 8,
      beatsPerBar: 4,
      secondsPerBeat: 0.5,
      startTime: 0,
      enable: { strum: false, bass: true, drums: false, metronome: false },
      ...defaultNewFields,
    });

    // scheduleBassNote(ctx, dest, frequency, time, options) — pair frequency
    // with start time for each hit.
    const scheduledNotes = scheduleBassNoteSpy.mock.calls.map((args) => [
      args[2],
      args[3],
    ]);
    expect(scheduledNotes).toEqual([
      [getNoteFrequency("C2"), 0],
      [getNoteFrequency("G2"), 1],
      [getNoteFrequency("C2"), 2],
      [getNoteFrequency("G2"), 3],
    ]);
  });
});
