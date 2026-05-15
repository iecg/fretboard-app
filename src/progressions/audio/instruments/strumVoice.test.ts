import { describe, it, expect, vi } from "vitest";
import { getNoteFrequency } from "@fretflow/core";
import { strumVoice, STRUM_LAG_SECONDS } from "./strumVoice";

// Minimal Web Audio mock — mirrors the node-creation tracking used in
// scheduler.test.ts so we can assert oscillator scheduling order.
function createMockGain() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };
}

function createMockFilter() {
  return {
    type: "lowpass" as BiquadFilterType,
    Q: { value: 1 },
    frequency: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };
}

function createMockOsc() {
  return {
    type: "sine" as OscillatorType,
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    setPeriodicWave: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as null | (() => void),
  };
}

function buildMockCtx() {
  const oscillators: ReturnType<typeof createMockOsc>[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    createGain: vi.fn(createMockGain),
    createBiquadFilter: vi.fn(createMockFilter),
    createOscillator: vi.fn(() => {
      const osc = createMockOsc();
      oscillators.push(osc);
      return osc;
    }),
    createPeriodicWave: vi.fn().mockReturnValue({} as PeriodicWave),
  };
  return { ctx, oscillators: () => oscillators };
}

describe("strumVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(strumVoice.scheduleChord).toBeTypeOf("function");
  });

  it("exports STRUM_LAG_SECONDS constant", () => {
    expect(STRUM_LAG_SECONDS).toBe(0.018);
  });

  it("strums low-to-high by default (down-stroke)", () => {
    const mock = buildMockCtx();
    const bus = createMockGain();
    const notes = ["C3", "E3", "G3"];

    strumVoice.scheduleChord(
      mock.ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      notes,
      0,
      { velocity: 0.8 },
    );

    const freqs = mock
      .oscillators()
      .map((osc) => osc.frequency.setValueAtTime.mock.calls[0]?.[0]);
    expect(freqs).toEqual(notes.map((n) => getNoteFrequency(n)));
  });

  it("reverses voicing order for an up-strum", () => {
    const mock = buildMockCtx();
    const bus = createMockGain();
    const notes = ["C3", "E3", "G3"];

    strumVoice.scheduleChord(
      mock.ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      notes,
      0,
      { velocity: 0.8, direction: "up" },
    );

    const oscillators = mock.oscillators();
    expect(oscillators).toHaveLength(3);

    // First scheduled note is the LAST note of the input array.
    const firstFreq = oscillators[0].frequency.setValueAtTime.mock.calls[0]?.[0];
    expect(firstFreq).toBe(getNoteFrequency("G3"));

    const freqs = oscillators.map(
      (osc) => osc.frequency.setValueAtTime.mock.calls[0]?.[0],
    );
    expect(freqs).toEqual([
      getNoteFrequency("G3"),
      getNoteFrequency("E3"),
      getNoteFrequency("C3"),
    ]);
  });
});
