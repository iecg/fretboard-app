import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted Tone synth spies. Same pattern as pianoVoice.test.ts.
const tone = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const t = await tone;
  return {
    PolySynth: t.spies.ctorSpy,
    Synth: function ToneSynthSentinel() {},
    now: () => 0,
  };
});

import { organVoice } from "./organVoice";

describe("organVoice — Tone.PolySynth backend", () => {
  let spies: Awaited<typeof tone>["spies"];

  beforeEach(async () => {
    const t = await tone;
    spies = t.spies;
    vi.useFakeTimers();
    t.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructs PolySynth with sine partials, organ envelope, -10 dB volume", () => {
    organVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    const [, opts] = spies.ctorSpy.mock.calls[0]!;
    // Tone requires `type: "custom"` whenever a partials array is supplied.
    // The drawbar-style partials approximate a Hammond registration.
    expect(opts.oscillator.type).toBe("custom");
    expect(opts.oscillator.partials).toEqual([1, 0.6, 0.4, 0.3, 0.2]);
    expect(opts.envelope.attack).toBeCloseTo(0.02, 3);
    expect(opts.envelope.decay).toBeCloseTo(0.05, 3);
    expect(opts.envelope.sustain).toBeCloseTo(0.9, 2);
    expect(opts.envelope.release).toBeCloseTo(0.6, 2);
    expect(opts.volume).toBe(-10);
  });

  it("triggers the full voicing once with the requested time + velocity (sustained default)", () => {
    organVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      4.0,
      { velocity: 0.5 },
    );
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    const [chord, duration, time, velocity] =
      spies.triggerAttackRelease.mock.calls[0]!;
    expect(chord).toEqual(["C3", "E3", "G3"]);
    expect(duration).toBeCloseTo(1.5, 3); // sustained (default)
    expect(time).toBeCloseTo(4.0, 3);
    expect(velocity).toBeCloseTo(0.5, 2);
  });

  it("uses the staccato duration when options.style === 'staccato'", () => {
    organVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7, style: "staccato" },
    );
    const [, duration] = spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBeCloseTo(0.2, 3);
  });

  it("uses the sustained duration when options.style === 'sustained'", () => {
    organVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7, style: "sustained" },
    );
    const [, duration] = spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBeCloseTo(1.5, 3);
  });

  it("skips zero-velocity chords (no PolySynth constructed)", () => {
    organVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0 },
    );
    expect(spies.ctorSpy).not.toHaveBeenCalled();
    expect(spies.triggerAttackRelease).not.toHaveBeenCalled();
  });

  it("skips empty voicings (no PolySynth constructed)", () => {
    organVoice.scheduleChord(
      {} as AudioNode,
      [],
      0,
      { velocity: 0.7 },
    );
    expect(spies.ctorSpy).not.toHaveBeenCalled();
    expect(spies.triggerAttackRelease).not.toHaveBeenCalled();
  });

  it("cancel() releases all voices then defers dispose past the release tail", () => {
    const handle = organVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    handle.cancel();
    expect(spies.releaseAll).toHaveBeenCalledTimes(1);
    expect(spies.dispose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(800); // > DISPOSE_TAIL_MS (700)
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancel() is idempotent — repeated calls schedule release/dispose only once", () => {
    const handle = organVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    handle.cancel();
    handle.cancel();
    handle.cancel();
    vi.advanceTimersByTime(800);
    expect(spies.releaseAll).toHaveBeenCalledTimes(1);
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });
});
