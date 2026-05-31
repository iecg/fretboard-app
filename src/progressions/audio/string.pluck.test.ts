import { describe, it, expect, beforeEach, vi } from "vitest";

const spies = vi.hoisted(() => ({
  pluckCtor: vi.fn(),
  pluckTAR: vi.fn(),
  gainCtor: vi.fn(),
  gainSet: vi.fn(),
  synthCtor: vi.fn(),
}));

vi.mock("tone", () => {
  class PluckSynth {
    constructor(opts: unknown) { spies.pluckCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease(...args: unknown[]) { spies.pluckTAR(...args); return this; }
  }
  class Gain {
    gain = { setValueAtTime: (...a: unknown[]) => spies.gainSet(...a) };
    constructor(v: unknown) { spies.gainCtor(v); }
    connect() { return this; }
    dispose() {}
  }
  class Synth {
    constructor(opts: unknown) { spies.synthCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease() { return this; }
  }
  return { PluckSynth, Gain, Synth, gainToDb: (v: number) => v, now: () => 0 };
});

import { pluckString } from "./string";
import type { StrumSpec } from "./sound/patchTypes";

const pluckSpec: StrumSpec = {
  pluck: { attackNoise: 1.2, dampening: 4500, resonance: 0.55, release: 0.12 },
  noteDurationSec: 0.18,
  releaseTailSec: 0.4,
};

describe("pluckString — Tone.PluckSynth backend", () => {
  beforeEach(() => {
    spies.pluckCtor.mockClear();
    spies.pluckTAR.mockClear();
    spies.gainCtor.mockClear();
    spies.gainSet.mockClear();
    spies.synthCtor.mockClear();
  });

  it("constructs a PluckSynth (not a Synth) from a pluck spec", () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0.7, spec: pluckSpec });
    expect(spies.pluckCtor).toHaveBeenCalledTimes(1);
    expect(spies.pluckCtor.mock.calls[0]![0]).toMatchObject({
      attackNoise: 1.2, dampening: 4500, resonance: 0.55, release: 0.12,
    });
    expect(spies.synthCtor).not.toHaveBeenCalled();
  });

  it("scales velocity via a gain stage at trigger time (PluckSynth ignores velocity)", () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0.7, spec: pluckSpec });
    expect(spies.gainCtor).toHaveBeenCalledTimes(1);
    expect(spies.gainSet).toHaveBeenCalledWith(0.7, 0);
    expect(spies.pluckTAR).toHaveBeenCalledTimes(1);
    const [freq, duration, time] = spies.pluckTAR.mock.calls[0]!;
    expect(Number(freq)).toBeCloseTo(220, 1);
    expect(duration).toBeCloseTo(0.18, 3);
    expect(time).toBeCloseTo(0, 3);
  });

  it("falls back to a Tone.Synth when the spec has no pluck", () => {
    pluckString({} as AudioNode, 220, 0, {
      velocity: 0.7,
      spec: { noteDurationSec: 0.18, releaseTailSec: 0.4 } as StrumSpec,
    });
    expect(spies.synthCtor).toHaveBeenCalledTimes(1);
    expect(spies.pluckCtor).not.toHaveBeenCalled();
  });
});
