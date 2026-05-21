import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted spies for Tone.PluckSynth. Same pattern as bass.test.ts /
// metronome.test.ts — re-installs the constructor implementation after
// each `mockReset()` via the helper's `reset()` callback.
const tone = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const t = await tone;
  return {
    PluckSynth: t.spies.ctorSpy,
    now: () => 0,
  };
});

import { pluckString } from "./string";

describe("pluckString — Tone.PluckSynth backend", () => {
  beforeEach(async () => {
    (await tone).reset();
  });

  it("constructs PluckSynth with Karplus-Strong options", async () => {
    pluckString({ currentTime: 0 } as AudioContext, {} as AudioNode, 220, 1.0);
    const t = await tone;
    expect(t.spies.ctorSpy).toHaveBeenCalledTimes(1);
    const [opts] = t.spies.ctorSpy.mock.calls[0]!;
    expect(opts.attackNoise).toBeGreaterThan(0);
    expect(opts.dampening).toBeGreaterThan(0);
    expect(opts.resonance).toBeGreaterThan(0);
    expect(opts.release).toBeGreaterThan(0);
  });

  it("triggers attack at requested freq + time + velocity", async () => {
    const t = await tone;
    pluckString(
      { currentTime: 0 } as AudioContext,
      {} as AudioNode,
      220,
      1.5,
      { velocity: 0.7 },
    );
    expect(t.spies.triggerAttack).toHaveBeenCalledTimes(1);
    const [pitch, time, velocity] = t.spies.triggerAttack.mock.calls[0]!;
    expect(Number(pitch)).toBeCloseTo(220, 1);
    expect(time).toBeCloseTo(1.5, 3);
    expect(velocity).toBeCloseTo(0.7, 2);
  });

  it("skips zero-velocity plucks (no synth constructed)", async () => {
    pluckString(
      { currentTime: 0 } as AudioContext,
      {} as AudioNode,
      220,
      0,
      { velocity: 0 },
    );
    const t = await tone;
    expect(t.spies.ctorSpy).not.toHaveBeenCalled();
  });

  it("cancel() defers dispose to let the comb-filter ring out", async () => {
    vi.useFakeTimers();
    try {
      const t = await tone;
      const h = pluckString(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        220,
        0,
      );
      h.cancel();
      // PluckSynth has no triggerRelease — the comb filter decays naturally.
      // Dispose should be deferred so the ring-out isn't truncated.
      expect(t.spies.dispose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1100); // PluckSynth release default is ~1s
      expect(t.spies.dispose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancel() is idempotent", async () => {
    vi.useFakeTimers();
    try {
      const t = await tone;
      const h = pluckString(
        { currentTime: 0 } as AudioContext,
        {} as AudioNode,
        220,
        0,
      );
      h.cancel();
      h.cancel();
      vi.advanceTimersByTime(1100);
      expect(t.spies.dispose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
