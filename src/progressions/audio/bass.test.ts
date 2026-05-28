import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture MonoSynth constructor options to assert patch params flow through.
const ctorCalls: unknown[] = [];
vi.mock("tone", () => {
  class FakeMonoSynth {
    constructor(opts: unknown) { ctorCalls.push(opts); }
    connect() { return this; }
    triggerAttackRelease() {}
    triggerRelease() {}
    dispose() {}
  }
  return { __esModule: true, MonoSynth: FakeMonoSynth, now: () => 0 };
});

import { scheduleBassNote } from "./bass";
import { getBassPatch } from "./sound/instrumentPatches";

beforeEach(() => { ctorCalls.length = 0; });

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

  it("reuses one pool per patch id (no new synth for same patch when idle)", () => {
    const dest = {} as unknown as AudioNode;
    const patch = getBassPatch("bass-upright")!;
    scheduleBassNote(dest, 55, 0, { velocity: 0.9, patch }).cancel();
    scheduleBassNote(dest, 55, 0, { velocity: 0.9, patch });
    expect(ctorCalls.length).toBe(1); // second lease reuses the idle voice
  });
});
