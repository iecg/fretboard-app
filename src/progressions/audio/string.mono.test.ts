import { describe, it, expect, beforeEach, vi } from "vitest";

const spies = vi.hoisted(() => ({
  monoCtor: vi.fn(),
  monoTAR: vi.fn(),
  synthCtor: vi.fn(),
  pluckCtor: vi.fn(),
  gainCtor: vi.fn(),
}));

vi.mock("tone", () => {
  class MonoSynth {
    constructor(opts: unknown) { spies.monoCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease(...args: unknown[]) { spies.monoTAR(...args); return this; }
  }
  class Synth {
    constructor(opts: unknown) { spies.synthCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease() { return this; }
  }
  class PluckSynth {
    constructor(opts: unknown) { spies.pluckCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease() { return this; }
  }
  class Gain {
    gain = { setValueAtTime: () => {} };
    constructor(v: unknown) { spies.gainCtor(v); }
    connect() { return this; }
    dispose() {}
  }
  return { MonoSynth, Synth, PluckSynth, Gain, gainToDb: (v: number) => v, now: () => 0 };
});

import { pluckString } from "./string";
import type { StrumSpec } from "./sound/patchTypes";

const monoSpec: StrumSpec = {
  mono: {
    oscillator: { type: "sawtooth" },
    filter: { type: "lowpass", Q: 1 },
    filterEnvelope: { attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.1, baseFrequency: 800, octaves: 2.8 },
    envelope: { attack: 0.004, decay: 0.2, sustain: 0.15, release: 0.1 },
  },
  noteDurationSec: 0.18,
  releaseTailSec: 0.4,
};

describe("pluckString — Tone.MonoSynth backend", () => {
  beforeEach(() => {
    spies.monoCtor.mockClear(); spies.monoTAR.mockClear();
    spies.synthCtor.mockClear(); spies.pluckCtor.mockClear(); spies.gainCtor.mockClear();
  });

  it("constructs a MonoSynth (not Synth/PluckSynth) from a mono spec", () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0.7, spec: monoSpec });
    expect(spies.monoCtor).toHaveBeenCalledTimes(1);
    expect(spies.monoCtor.mock.calls[0]![0]).toMatchObject({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", Q: 1 },
    });
    expect(spies.synthCtor).not.toHaveBeenCalled();
    expect(spies.pluckCtor).not.toHaveBeenCalled();
  });

  it("passes velocity natively to triggerAttackRelease (no gain stage)", () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0.7, spec: monoSpec });
    expect(spies.monoTAR).toHaveBeenCalledTimes(1);
    const [freq, duration, time, velocity] = spies.monoTAR.mock.calls[0]!;
    expect(Number(freq)).toBeCloseTo(220, 1);
    expect(duration).toBeCloseTo(0.18, 3);
    expect(time).toBeCloseTo(0, 3);
    expect(velocity).toBeCloseTo(0.7, 3);
    expect(spies.gainCtor).not.toHaveBeenCalled();
  });
});
