import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Same hoisted-spy pattern as metronome.test.ts. We use the shared
// createToneSynthSpies helper because MonoSynth exposes the same call
// surface we care about (ctor, triggerAttackRelease, triggerRelease,
// connect, dispose). Routing the helper's ctor spy through `Tone.MonoSynth`
// in the mock keeps the test surface aligned with the metronome suite.
const synth = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const s = await synth;
  return {
    MonoSynth: s.spies.ctorSpy,
    now: () => 0,
  };
});

import { scheduleBassNote } from "./bass";

describe("scheduleBassNote — Tone backend", () => {
  let spies: Awaited<typeof synth>["spies"];

  beforeEach(async () => {
    const s = await synth;
    spies = s.spies;
    vi.useFakeTimers();
    s.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructs MonoSynth with sawtooth oscillator + lowpass filter envelope", () => {
    scheduleBassNote({ currentTime: 0 } as AudioContext, {} as AudioNode, 220, 1.0);
    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    const [opts] = spies.ctorSpy.mock.calls[0]!;
    expect(opts.oscillator.type).toBe("sawtooth");
    expect(opts.filter.type).toBe("lowpass");
    expect(opts.filterEnvelope.baseFrequency).toBeCloseTo(1200, 0);
  });

  it("triggers at the requested frequency and time", () => {
    scheduleBassNote(
      { currentTime: 0 } as AudioContext,
      {} as AudioNode,
      110,
      2.5,
      { velocity: 0.8 },
    );
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    const [pitch, , time, velocity] = spies.triggerAttackRelease.mock.calls[0]!;
    expect(Number(pitch)).toBeCloseTo(110, 1);
    expect(time).toBeCloseTo(2.5, 3);
    expect(velocity).toBeCloseTo(0.8, 2);
  });

  it("skips zero-velocity notes (no synth constructed)", () => {
    scheduleBassNote(
      { currentTime: 0 } as AudioContext,
      {} as AudioNode,
      110,
      0,
      { velocity: 0 },
    );
    expect(spies.ctorSpy).not.toHaveBeenCalled();
    expect(spies.triggerAttackRelease).not.toHaveBeenCalled();
  });

  it("cancel() releases then disposes the synth after the envelope settles", () => {
    const handle = scheduleBassNote(
      { currentTime: 0 } as AudioContext,
      {} as AudioNode,
      110,
      0,
    );
    handle.cancel();
    // Release fires immediately so the envelope can decay naturally.
    expect(spies.triggerRelease).toHaveBeenCalledTimes(1);
    // Dispose is deferred via setTimeout so the release tail isn't truncated.
    expect(spies.dispose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60); // matches the dispose-deferral window in production
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancel() is idempotent — repeated calls schedule release/dispose only once", () => {
    const handle = scheduleBassNote(
      { currentTime: 0 } as AudioContext,
      {} as AudioNode,
      110,
      0,
    );
    handle.cancel();
    handle.cancel();
    handle.cancel();
    vi.advanceTimersByTime(60);
    expect(spies.triggerRelease).toHaveBeenCalledTimes(1);
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });
});
