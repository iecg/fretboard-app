import { describe, it, expect, vi, beforeEach } from "vitest";

const ctorCalls: unknown[] = [];
let nowValue = 0;
vi.mock("tone", () => {
  class FakeMonoSynth {
    constructor(opts: unknown) { ctorCalls.push(opts); }
    connect() { return this; }
    triggerAttackRelease() {}
    triggerRelease() {}
    dispose() {}
  }
  return { __esModule: true, MonoSynth: FakeMonoSynth, now: () => nowValue };
});

import { scheduleBassNote } from "./bass";
import { getBassPatch } from "./sound/instrumentPatches";

beforeEach(() => { ctorCalls.length = 0; nowValue = 0; });

describe("patch-driven bass", () => {
  it("builds a MonoSynth using the supplied patch's oscillator + live filter env", () => {
    const dest = {} as unknown as AudioNode;
    const patch = getBassPatch("bass-finger")!;
    scheduleBassNote(dest, 110, 0, { velocity: 0.9, patch });
    expect(ctorCalls.length).toBe(1);
    const opts = ctorCalls[0] as { oscillator: { type: string }; filterEnvelope: { octaves: number } };
    expect(opts.oscillator.type).toBe("sawtooth");
    expect(opts.filterEnvelope.octaves).toBeGreaterThan(0);
  });

  it("reuses one pool per patch id and separates pools across patches", () => {
    const dest = {} as unknown as AudioNode;
    const finger = getBassPatch("bass-finger")!;
    const upright = getBassPatch("bass-upright")!;
    scheduleBassNote(dest, 110, 0, { velocity: 0.9, patch: finger }); // builds synth #1
    expect(ctorCalls.length).toBe(1);
    nowValue = 5; // advance past the first note's busy window so the voice is idle
    scheduleBassNote(dest, 110, 5, { velocity: 0.9, patch: finger }); // reuses #1
    expect(ctorCalls.length).toBe(1);
    scheduleBassNote(dest, 110, 5, { velocity: 0.9, patch: upright }); // different patch → synth #2
    expect(ctorCalls.length).toBe(2);
  });
});
