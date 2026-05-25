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
    gainToDb: (v: number) => 20 * Math.log10(Math.max(1e-6, v)),
    now: () => t.now(),
  };
});

import { pluckString } from "./string";

describe("pluckString — Tone.PluckSynth backend", () => {
  beforeEach(async () => {
    (await tone).reset();
  });

  it("constructs PluckSynth with Karplus-Strong options", async () => {
    pluckString({} as AudioNode, 220, 1.0);
    const t = await tone;
    expect(t.spies.ctorSpy).toHaveBeenCalledTimes(1);
    const [opts] = t.spies.ctorSpy.mock.calls[0]!;
    expect(opts.attackNoise).toBeGreaterThan(0);
    expect(opts.dampening).toBeGreaterThan(0);
    expect(opts.resonance).toBeGreaterThan(0);
    expect(opts.release).toBeGreaterThan(0);
  });

  it("triggers attack at requested freq + time", async () => {
    const t = await tone;
    pluckString(
      {} as AudioNode,
      220,
      1.5,
      { velocity: 0.7 },
    );
    expect(t.spies.triggerAttack).toHaveBeenCalledTimes(1);
    const [pitch, time] = t.spies.triggerAttack.mock.calls[0]!;
    expect(Number(pitch)).toBeCloseTo(220, 1);
    expect(time).toBeCloseTo(1.5, 3);
  });

  it("applies velocity via synth.volume (gainToDb)", async () => {
    const t = await tone;
    pluckString(
      {} as AudioNode,
      220,
      0,
      { velocity: 0.5 },
    );
    // Constructor was called as `new Tone.PluckSynth(...)`; the
    // mockImplementation's return value is the stub instance, captured via
    // mock.results. Assert its `volume.value` was set to gainToDb(0.5).
    expect(t.spies.ctorSpy).toHaveBeenCalledTimes(1);
    const instance = t.spies.ctorSpy.mock.results[0]!.value as {
      volume: { value: number };
    };
    // gainToDb(0.5) = 20 * log10(0.5) ≈ -6.0206 dB
    expect(instance.volume.value).toBeCloseTo(-6.0206, 2);
  });

  it("skips zero-velocity plucks (no synth constructed)", async () => {
    pluckString(
      {} as AudioNode,
      220,
      0,
      { velocity: 0 },
    );
    const t = await tone;
    expect(t.spies.ctorSpy).not.toHaveBeenCalled();
  });

  it("pool reuses PluckSynth instances across non-overlapping plucks against the same dest", async () => {
    const t = await tone;
    const dest = {} as AudioNode;

    // 5 plucks at well-separated times, all against the same dest.
    // RELEASE_TAIL is ~1.1s; spacing plucks 5s apart guarantees the prior
    // voice's busy window has passed, so the pool can reuse the same entry.
    // We must advance Tone.now() between plucks so the pool's
    // `busyUntil <= now` check sees prior voices as available.
    for (let i = 0; i < 5; i++) {
      t.setNow(i * 5);
      pluckString(dest, 220, i * 5);
    }

    // triggerAttack fires 5 times (once per pluck) regardless of pooling.
    expect(t.spies.triggerAttack).toHaveBeenCalledTimes(5);
    // But the constructor should fire FAR fewer than 5 times — ideally 1
    // (single reused voice). Strict bound: less than 5 = the pool worked.
    expect(t.spies.ctorSpy.mock.calls.length).toBeLessThan(5);
  });

  it("cancel() releases the voice back to the pool (no dispose at cancel time)", async () => {
    const t = await tone;
    const h = pluckString({} as AudioNode, 220, 0);
    h.cancel();
    // With pooling, cancel does NOT call synth.dispose() — the voice stays
    // leased until busyUntil passes, then becomes available for reuse.
    expect(t.spies.dispose).not.toHaveBeenCalled();
  });

  it("cancel() is idempotent (second call is a no-op)", async () => {
    const t = await tone;
    const h = pluckString({} as AudioNode, 220, 0);
    // First cancel: returns cleanly
    expect(() => h.cancel()).not.toThrow();
    // Second cancel: also returns cleanly, no exception
    expect(() => h.cancel()).not.toThrow();
    // No dispose was called (voice is pooled).
    expect(t.spies.dispose).not.toHaveBeenCalled();
  });
});
