import { beforeEach, describe, expect, it } from "vitest";
import { getNoteFrequency } from "@fretflow/core";
import { scheduleProgressionStep } from "./scheduler";
import { _metronomeInternals } from "./metronome";
import {
  buildMockCtx as buildSharedMockCtx,
  createMockGain,
  type MockAudioContext,
  type MockBufferSourceNode,
  type MockOscillatorNode,
} from "../../test-utils/mockWebAudio";

// Web Audio mock — counts node creations so tests can assert "drums scheduled
// X hits" without depending on real audio timing.

interface MockCtx {
  ctx: MockAudioContext;
  oscCount: () => number;
  bufferSourceCount: () => number;
  oscillators: () => MockOscillatorNode[];
  bufferSources: () => MockBufferSourceNode[];
}

function buildMockCtx(): MockCtx {
  const ctx = buildSharedMockCtx();
  return {
    ctx,
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
    // Beats 0 and 2 = two bass oscillators.
    expect(mock.oscCount()).toBe(2);
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

    expect(mock.oscCount()).toBe(2);
    expect(mock.oscillators()[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      getNoteFrequency("C2"),
      0,
    );
    expect(mock.oscillators()[1].frequency.setValueAtTime).toHaveBeenCalledWith(
      getNoteFrequency("G2"),
      1,
    );
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
    expect(mock.oscCount()).toBe(4);
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

    const scheduledSources = mock.oscillators();
    expect(scheduledSources).toHaveLength(4);
    expect(scheduledSources.every((source) => source.stop.mock.calls.length === 1))
      .toBe(true);

    handle.cancelAll();

    expect(scheduledSources.every((source) => source.stop.mock.calls.length >= 2))
      .toBe(true);
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

    const startTimes = mock.oscillators().map((source) => source.start.mock.calls[0]?.[0]);
    expect(startTimes).toEqual([11, 11.5]);
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

    const frequencies = mock.oscillators().map((osc) =>
      osc.frequency.setValueAtTime.mock.calls[0]?.[0],
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

    const scheduledNotes = mock.oscillators().map((osc) =>
      osc.frequency.setValueAtTime.mock.calls[0],
    );
    expect(scheduledNotes).toEqual([
      [getNoteFrequency("C2"), 0],
      [getNoteFrequency("G2"), 1],
      [getNoteFrequency("C2"), 2],
      [getNoteFrequency("G2"), 3],
    ]);
  });
});
