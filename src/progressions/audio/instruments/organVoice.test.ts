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
    now: () => t.now(),
  };
});

import type { ChordVoice } from "./types";

describe("organVoice — Tone.PolySynth backend", () => {
  let spies: Awaited<typeof tone>["spies"];
  let organVoice: ChordVoice;

  beforeEach(async () => {
    const t = await tone;
    spies = t.spies;
    vi.useFakeTimers();
    t.reset();
    vi.resetModules();
    ({ organVoice } = await import("./organVoice"));
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

  it("triggers the full voicing once with the requested time + velocity (sustained default)", async () => {
    const t = await tone;
    organVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      4.0,
      { velocity: 0.5 },
    );
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    expect(spies.playbackAttackRelease).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4_500);
    t.setNow(4.5);
    expect(spies.playbackAttackRelease).toHaveBeenCalledTimes(1);
    const [chord, duration, time, velocity] =
      spies.playbackAttackRelease.mock.calls[0]!;
    expect(chord).toEqual(["C3", "E3", "G3"]);
    expect(duration).toBeCloseTo(1.5, 3); // sustained (default)
    expect(time).toBeCloseTo(4.0, 3);
    expect(velocity).toBeCloseTo(0.5, 2);
  });

  it("reuses one PolySynth for non-overlapping organ schedules on the same destination", async () => {
    const t = await tone;
    const dest = {} as AudioNode;
    organVoice.scheduleChord(dest, ["C3", "E3", "G3"], 0, {
      velocity: 0.7,
    });
    t.setNow(2.2);
    organVoice.scheduleChord(dest, ["D3", "F3", "A3"], 2.3, {
      velocity: 0.7,
    });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
    expect(spies.ctorSpy.mock.results[0]?.value.maxPolyphony).toBe(32);
  });

  it("keeps different destinations on different leased synths", async () => {
    const t = await tone;
    const firstDest = {} as AudioNode;
    const secondDest = {} as AudioNode;

    organVoice.scheduleChord(firstDest, ["C3", "E3", "G3"], 0, { velocity: 0.7 });
    t.setNow(2.2);
    organVoice.scheduleChord(secondDest, ["D3", "F3", "A3"], 2.3, {
      velocity: 0.7,
    });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(2);
    expect(spies.connect).toHaveBeenCalledTimes(2);
    expect(spies.disconnect).not.toHaveBeenCalled();
    const [firstInstance, secondInstance] = t.instances;
    expect(firstInstance?.connect).toHaveBeenCalledWith(firstDest);
    expect(secondInstance?.connect).toHaveBeenCalledWith(secondDest);
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

  it("cancel() releases only that leased synth after playback has started", async () => {
    const t = await tone;
    const handle = organVoice.scheduleChord(
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
    const firstHandle = organVoice.scheduleChord(
      dest,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.7 },
    );
    const secondHandle = organVoice.scheduleChord(
      dest,
      ["D3", "F3", "A3"],
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
    const handle = organVoice.scheduleChord(dest, ["C3", "E3", "G3"], 0, {
      velocity: 0.7,
    });

    t.setNow(2.2);
    handle.cancel();
    organVoice.scheduleChord(dest, ["D3", "F3", "A3"], 2.3, { velocity: 0.7 });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
  });

  it("cancel() prevents a future-scheduled chord from ever being attacked", async () => {
    const t = await tone;
    const handle = organVoice.scheduleChord(
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
    const handle = organVoice.scheduleChord(
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
