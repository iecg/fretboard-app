import { describe, it, expect, beforeEach, vi } from "vitest";

const tone = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const t = await tone;
  return {
    Synth: t.spies.ctorSpy,
    gainToDb: (v: number) => 20 * Math.log10(Math.max(1e-6, v)),
    now: () => t.now(),
  };
});

import { pluckString } from "./string";

describe("pluckString — Tone.Synth backend", () => {
  beforeEach(async () => {
    (await tone).reset();
  });

  it("constructs Synth with custom oscillator partials and fast-decay envelope", async () => {
    pluckString({} as AudioNode, 220, 1.0);
    const t = await tone;
    expect(t.spies.ctorSpy).toHaveBeenCalledTimes(1);
    const [opts] = t.spies.ctorSpy.mock.calls[0]!;
    expect(opts.oscillator.type).toBe("custom");
    expect(opts.oscillator.partials).toEqual([1, 0.8, 0.45, 0.22, 0.12, 0.05]);
    expect(opts.envelope.attack).toBeCloseTo(0.01);
    expect(opts.envelope.decay).toBeCloseTo(1.1);
    expect(opts.envelope.sustain).toBeCloseTo(0.05);
    expect(opts.envelope.release).toBeCloseTo(0.4);
  });

  it("triggers attack-release at requested freq + time with velocity", async () => {
    const t = await tone;
    pluckString({} as AudioNode, 220, 1.5, { velocity: 0.7 });
    expect(t.spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    const [pitch, duration, time, vel] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(Number(pitch)).toBeCloseTo(220, 1);
    expect(duration).toBeCloseTo(1.8, 2);
    expect(time).toBeCloseTo(1.5, 3);
    expect(vel).toBeCloseTo(0.7, 2);
  });

  it("skips zero-velocity plucks (no synth constructed)", async () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0 });
    const t = await tone;
    expect(t.spies.ctorSpy).not.toHaveBeenCalled();
  });

  it("pool reuses Synth instances across non-overlapping plucks against the same dest", async () => {
    const t = await tone;
    const dest = {} as AudioNode;
    for (let i = 0; i < 5; i++) {
      t.setNow(i * 5);
      pluckString(dest, 220, i * 5);
    }
    expect(t.spies.triggerAttackRelease).toHaveBeenCalledTimes(5);
    expect(t.spies.ctorSpy.mock.calls.length).toBeLessThan(5);
  });

  it("cancel() does not dispose the pooled voice", async () => {
    const t = await tone;
    const h = pluckString({} as AudioNode, 220, 0);
    h.cancel();
    expect(t.spies.dispose).not.toHaveBeenCalled();
  });

  it("cancel() is idempotent", async () => {
    const t = await tone;
    const h = pluckString({} as AudioNode, 220, 0);
    expect(() => h.cancel()).not.toThrow();
    expect(() => h.cancel()).not.toThrow();
    expect(t.spies.dispose).not.toHaveBeenCalled();
  });

  it("overrides the patch note duration with durationSec when provided", async () => {
    const t = await tone;
    pluckString({} as AudioNode, 220, 0, { velocity: 0.8, durationSec: 0.06 });
    const [, duration] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBeCloseTo(0.06, 3);
  });
});
