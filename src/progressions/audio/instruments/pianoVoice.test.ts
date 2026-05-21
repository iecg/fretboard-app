import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted Tone synth spies. Same pattern as bass.test.ts / string.test.ts —
// routing the helper's ctor spy through `Tone.PolySynth` keeps the surface
// aligned with the rest of the backing-track suite. Tone.Synth is exposed
// as a sentinel so the PolySynth call site can pass it as the voice
// constructor without us caring about its real implementation.
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

import { pianoVoice } from "./pianoVoice";

describe("pianoVoice — Tone.PolySynth backend", () => {
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

  it("constructs PolySynth with triangle partials, piano envelope, -6 dB volume", () => {
    pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    // Voice constructor is arg[0]; options are arg[1].
    const [, opts] = spies.ctorSpy.mock.calls[0]!;
    // Tone requires `type: "custom"` whenever a partials array is supplied.
    // The descending partials give a triangle-flavoured percussive timbre.
    expect(opts.oscillator.type).toBe("custom");
    expect(opts.oscillator.partials).toEqual([1, 0.5, 0.25, 0.12]);
    expect(opts.envelope.attack).toBeCloseTo(0.005, 3);
    expect(opts.envelope.decay).toBeCloseTo(0.4, 2);
    expect(opts.envelope.sustain).toBeCloseTo(0.1, 2);
    expect(opts.envelope.release).toBeCloseTo(1.2, 2);
    expect(opts.volume).toBe(-6);
  });

  it("triggers the full voicing once with the requested time + velocity (staccato default)", () => {
    pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      2.5,
      { velocity: 0.6 },
    );
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    const [chord, duration, time, velocity] =
      spies.triggerAttackRelease.mock.calls[0]!;
    expect(chord).toEqual(["C3", "E3", "G3"]);
    expect(duration).toBeCloseTo(0.4, 3); // staccato (default)
    expect(time).toBeCloseTo(2.5, 3);
    expect(velocity).toBeCloseTo(0.6, 2);
  });

  it("uses the sustained duration when options.style === 'sustained'", () => {
    pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7, style: "sustained" },
    );
    const [, duration] = spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBeCloseTo(1.2, 3);
  });

  it("uses the staccato duration when options.style === 'staccato'", () => {
    pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7, style: "staccato" },
    );
    const [, duration] = spies.triggerAttackRelease.mock.calls[0]!;
    expect(duration).toBeCloseTo(0.4, 3);
  });

  it("skips zero-velocity chords (no PolySynth constructed)", () => {
    pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0 },
    );
    expect(spies.ctorSpy).not.toHaveBeenCalled();
    expect(spies.triggerAttackRelease).not.toHaveBeenCalled();
  });

  it("skips empty voicings (no PolySynth constructed)", () => {
    pianoVoice.scheduleChord(
      {} as AudioNode,
      [],
      0,
      { velocity: 0.7 },
    );
    expect(spies.ctorSpy).not.toHaveBeenCalled();
    expect(spies.triggerAttackRelease).not.toHaveBeenCalled();
  });

  it("cancel() releases all voices then defers dispose past the release tail", () => {
    const handle = pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    handle.cancel();
    expect(spies.releaseAll).toHaveBeenCalledTimes(1);
    // Dispose is deferred so the 1.2s release tail isn't truncated.
    expect(spies.dispose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1400); // > DISPOSE_TAIL_MS (1300)
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancel() is idempotent — repeated calls schedule release/dispose only once", () => {
    const handle = pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    handle.cancel();
    handle.cancel();
    handle.cancel();
    vi.advanceTimersByTime(1400);
    expect(spies.releaseAll).toHaveBeenCalledTimes(1);
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });
});
