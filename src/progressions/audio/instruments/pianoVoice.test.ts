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
    now: () => t.now(),
  };
});

import type { ChordVoice } from "./types";

describe("pianoVoice — Tone.PolySynth backend", () => {
  let spies: Awaited<typeof tone>["spies"];
  let pianoVoice: ChordVoice;

  beforeEach(async () => {
    const t = await tone;
    spies = t.spies;
    vi.useFakeTimers();
    t.reset();
    vi.resetModules();
    ({ pianoVoice } = await import("./pianoVoice"));
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

  it("triggers the full voicing once with the requested time + velocity (staccato default)", async () => {
    const t = await tone;
    pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      2.5,
      { velocity: 0.6 },
    );
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    expect(spies.playbackAttackRelease).not.toHaveBeenCalled();
    const [scheduledChord, scheduledDuration, scheduledTime, scheduledVelocity] =
      spies.triggerAttackRelease.mock.calls[0]!;
    expect(scheduledChord).toEqual(["C3", "E3", "G3"]);
    expect(scheduledDuration).toBeCloseTo(0.4, 3);
    expect(scheduledTime).toBeCloseTo(2.5, 3);
    expect(scheduledVelocity).toBeCloseTo(0.6, 2);
    await vi.advanceTimersByTimeAsync(3_000);
    t.setNow(3);
    expect(spies.playbackAttackRelease).toHaveBeenCalledTimes(1);
    const [chord, duration, time, velocity] =
      spies.playbackAttackRelease.mock.calls[0]!;
    expect(chord).toEqual(["C3", "E3", "G3"]);
    expect(duration).toBeCloseTo(0.4, 3); // staccato (default)
    expect(time).toBeCloseTo(2.5, 3);
    expect(velocity).toBeCloseTo(0.6, 2);
  });

  it("reuses one PolySynth for non-overlapping piano schedules on the same destination", async () => {
    const t = await tone;
    const dest = {} as AudioNode;
    pianoVoice.scheduleChord(dest, ["C3", "E3", "G3"], 0, {
      velocity: 0.7,
      style: "staccato",
    });
    t.setNow(2);
    pianoVoice.scheduleChord(dest, ["F3", "A3", "C4"], 2.1, {
      velocity: 0.7,
      style: "staccato",
    });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    expect(spies.ctorSpy.mock.results[0]?.value.maxPolyphony).toBe(32);
  });

  it("allocates separate PolySynths for future hits scheduled in one pass", () => {
    const dest = {} as AudioNode;

    pianoVoice.scheduleChord(dest, ["C3", "E3", "G3"], 4, {
      velocity: 0.7,
      style: "staccato",
    });
    pianoVoice.scheduleChord(dest, ["E3", "G3", "B3"], 4.5, {
      velocity: 0.7,
      style: "staccato",
    });
    pianoVoice.scheduleChord(dest, ["G3", "B3", "D4"], 5.7, {
      velocity: 0.7,
      style: "staccato",
    });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(3);
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(3);
  });

  it("keeps different destinations on different leased synths", async () => {
    const t = await tone;
    const firstDest = {} as AudioNode;
    const secondDest = {} as AudioNode;

    pianoVoice.scheduleChord(firstDest, ["C3", "E3", "G3"], 0, {
      velocity: 0.7,
      style: "staccato",
    });
    t.setNow(2);
    pianoVoice.scheduleChord(secondDest, ["F3", "A3", "C4"], 2.1, {
      velocity: 0.7,
      style: "staccato",
    });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(2);
    expect(spies.connect).toHaveBeenCalledTimes(2);
    expect(spies.disconnect).not.toHaveBeenCalled();
    const [firstInstance, secondInstance] = t.instances;
    expect(firstInstance?.connect).toHaveBeenCalledWith(firstDest);
    expect(secondInstance?.connect).toHaveBeenCalledWith(secondDest);
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

  it("cancel() releases only that leased synth after playback has started", async () => {
    const t = await tone;
    const handle = pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    await vi.advanceTimersByTimeAsync(1);
    t.setNow(0.001);
    handle.cancel();
    expect(spies.releaseAll).toHaveBeenCalledTimes(1);
    expect(spies.releaseAll).toHaveBeenCalledWith(0.001);
    expect(spies.triggerRelease).not.toHaveBeenCalled();
    expect(spies.dispose).not.toHaveBeenCalled();
  });

  it("cancel() leaves another leased synth untouched", async () => {
    const t = await tone;
    const dest = {} as AudioNode;
    const firstHandle = pianoVoice.scheduleChord(
      dest,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    const secondHandle = pianoVoice.scheduleChord(
      dest,
      ["F3", "A3", "C4"],
      0,
      { velocity: 0.7 },
    );

    await vi.advanceTimersByTimeAsync(1);
    t.setNow(0.001);
    firstHandle.cancel();

    const [firstInstance, secondInstance] = (await tone).instances;
    expect(firstInstance?.releaseAll).toHaveBeenCalledTimes(1);
    expect(secondInstance?.releaseAll).not.toHaveBeenCalled();

    secondHandle.cancel();

    expect(firstInstance?.releaseAll).toHaveBeenCalledTimes(1);
    expect(secondInstance?.releaseAll).toHaveBeenCalledTimes(1);
    expect(spies.dispose).not.toHaveBeenCalled();
  });

  it("late cancel after the busy window does not block same-destination reuse", async () => {
    const t = await tone;
    const dest = {} as AudioNode;
    const handle = pianoVoice.scheduleChord(dest, ["C3", "E3", "G3"], 0, {
      velocity: 0.7,
      style: "staccato",
    });

    t.setNow(2);
    handle.cancel();
    pianoVoice.scheduleChord(dest, ["F3", "A3", "C4"], 2.1, {
      velocity: 0.7,
      style: "staccato",
    });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
  });

  it("cancel() becomes a no-op after that pooled synth lease is reassigned", async () => {
    const t = await tone;
    const dest = {} as AudioNode;
    const firstHandle = pianoVoice.scheduleChord(dest, ["C3", "E3", "G3"], 0, {
      velocity: 0.7,
      style: "staccato",
    });

    t.setNow(2);
    const secondHandle = pianoVoice.scheduleChord(dest, ["F3", "A3", "C4"], 2.1, {
      velocity: 0.7,
      style: "staccato",
    });

    await vi.advanceTimersByTimeAsync(2_200);
    t.setNow(2.2);
    firstHandle.cancel();

    const [sharedInstance] = t.instances;
    expect(sharedInstance?.releaseAll).not.toHaveBeenCalled();

    secondHandle.cancel();

    expect(sharedInstance?.releaseAll).toHaveBeenCalledTimes(1);
    expect(sharedInstance?.releaseAll).toHaveBeenCalledWith(2.2);
  });

  it("cancel() prevents a future-scheduled chord from ever being attacked", async () => {
    const t = await tone;
    const handle = pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      2,
      { velocity: 0.7 },
    );

    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    expect(spies.playbackAttackRelease).not.toHaveBeenCalled();
    handle.cancel();
    await vi.advanceTimersByTimeAsync(2_500);
    t.setNow(2.5);

    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    expect(spies.playbackAttackRelease).not.toHaveBeenCalled();
    expect(spies.triggerRelease).not.toHaveBeenCalled();
    expect(spies.releaseAll).not.toHaveBeenCalled();
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancel() is idempotent — repeated calls release only once", async () => {
    const t = await tone;
    const handle = pianoVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    await vi.advanceTimersByTimeAsync(1);
    t.setNow(0.001);
    handle.cancel();
    handle.cancel();
    handle.cancel();
    expect(spies.releaseAll).toHaveBeenCalledTimes(1);
    expect(spies.dispose).not.toHaveBeenCalled();
  });
});
