import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Shared hoisted-spy Tone mock (same pattern as metronome.test.ts). The helper
// exposes setNow/now so we can advance the audio clock to exercise pool reuse.
const synth = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const s = await synth;
  return {
    MonoSynth: s.spies.ctorSpy,
    now: () => s.now(),
  };
});

import { scheduleBassNote } from "./bass";
import { getBassPatch } from "./sound/instrumentPatches";

describe("scheduleBassNote — patch-driven Tone backend", () => {
  let s: Awaited<typeof synth>;
  let spies: Awaited<typeof synth>["spies"];

  beforeEach(async () => {
    s = await synth;
    spies = s.spies;
    vi.useFakeTimers();
    s.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the bass-finger patch: triangle + live lowpass filter envelope", () => {
    scheduleBassNote({} as AudioNode, 220, 1.0);
    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    const [opts] = spies.ctorSpy.mock.calls[0]!;
    expect(opts.oscillator.type).toBe("triangle");
    expect(opts.filter.type).toBe("lowpass");
    expect(opts.filterEnvelope.baseFrequency).toBeCloseTo(250, 0);
    expect(opts.filterEnvelope.octaves).toBeGreaterThan(0);
  });

  it("uses the supplied patch's oscillator + filter envelope", () => {
    const upright = getBassPatch("bass-upright")!;
    scheduleBassNote({} as AudioNode, 110, 0, { velocity: 0.9, patch: upright });
    const [opts] = spies.ctorSpy.mock.calls[0]!;
    // Harmonic-rich (triangle), not a pure sine — a sine upright was inaudible
    // on small speakers across blues/jazz/ballad (the genres that share it).
    expect(opts.oscillator.type).toBe("triangle");
    expect(opts.filterEnvelope.octaves).toBeGreaterThan(0);
  });

  it("triggers at the requested frequency, time, and velocity", () => {
    scheduleBassNote({} as AudioNode, 110, 2.5, { velocity: 0.8 });
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    const [pitch, , time, velocity] = spies.triggerAttackRelease.mock.calls[0]!;
    expect(Number(pitch)).toBeCloseTo(110, 1);
    expect(time).toBeCloseTo(2.5, 3);
    expect(velocity).toBeCloseTo(0.8, 2);
  });

  it("skips zero-velocity notes (no synth constructed)", () => {
    scheduleBassNote({} as AudioNode, 110, 0, { velocity: 0 });
    expect(spies.ctorSpy).not.toHaveBeenCalled();
    expect(spies.triggerAttackRelease).not.toHaveBeenCalled();
  });

  it("cancel() before the scheduled start disposes the voice without releasing (kills the pending note)", () => {
    // now (0) < scheduled time (5): the note is queued but hasn't started, so
    // the monophonic voice is disposed outright to cancel the pending
    // triggerAttackRelease — otherwise the next chord's bass would bleed in.
    const handle = scheduleBassNote({} as AudioNode, 110, 5, { velocity: 0.9 });
    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    handle.cancel();
    expect(spies.triggerRelease).not.toHaveBeenCalled();
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancel() releases then disposes the synth after the envelope settles", () => {
    const handle = scheduleBassNote({} as AudioNode, 110, 0);
    handle.cancel();
    expect(spies.triggerRelease).toHaveBeenCalledTimes(1);
    expect(spies.dispose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60); // > DISPOSE_TAIL_MS (50)
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancel() is idempotent — release/dispose happen only once", () => {
    const handle = scheduleBassNote({} as AudioNode, 110, 0);
    handle.cancel();
    handle.cancel();
    handle.cancel();
    vi.advanceTimersByTime(60);
    expect(spies.triggerRelease).toHaveBeenCalledTimes(1);
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });

  it("reuses one pool per patch id and separates pools across patches", () => {
    const dest = {} as AudioNode;
    const finger = getBassPatch("bass-finger")!;
    const upright = getBassPatch("bass-upright")!;
    scheduleBassNote(dest, 110, 0, { velocity: 0.9, patch: finger }); // synth #1
    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    s.setNow(5); // advance past the first note's busy window so the voice is idle
    scheduleBassNote(dest, 110, 5, { velocity: 0.9, patch: finger }); // reuses #1
    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    scheduleBassNote(dest, 110, 5, { velocity: 0.9, patch: upright }); // different patch → #2
    expect(spies.ctorSpy).toHaveBeenCalledTimes(2);
  });
});
