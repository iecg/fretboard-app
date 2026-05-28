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
    now: () => s.now(),
  };
});

describe("scheduleBassNote — Tone backend", () => {
  let spies: Awaited<typeof synth>["spies"];
  let tone: Awaited<typeof synth>;
  let scheduleBassNote: typeof import("./bass").scheduleBassNote;

  beforeEach(async () => {
    tone = await synth;
    spies = tone.spies;
    vi.useFakeTimers();
    tone.reset();
    vi.resetModules();
    ({ scheduleBassNote } = await import("./bass"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructs MonoSynth with sawtooth oscillator + lowpass filter envelope", () => {
    scheduleBassNote({} as AudioNode, 220, 1.0);
    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    const [opts] = spies.ctorSpy.mock.calls[0]!;
    expect(opts.oscillator.type).toBe("sawtooth");
    expect(opts.filter.type).toBe("lowpass");
    expect(opts.filterEnvelope.baseFrequency).toBeCloseTo(1200, 0);
  });

  it("triggers at the requested frequency and time", () => {
    scheduleBassNote(
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

  it("reuses one MonoSynth for non-overlapping notes on the same destination", () => {
    const dest = {} as AudioNode;
    scheduleBassNote(dest, 110, 0, { velocity: 0.8 });
    tone.setNow(1.2);
    scheduleBassNote(dest, 146.83, 1.3, { velocity: 0.75 });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
  });

  it("allocates separate MonoSynths for future notes scheduled in one pass", () => {
    const dest = {} as AudioNode;
    scheduleBassNote(dest, 110, 2, { velocity: 0.8 });
    scheduleBassNote(dest, 146.83, 3, { velocity: 0.75 });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(2);
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
  });

  it("keeps different destinations on different leased synths", () => {
    const firstDest = {} as AudioNode;
    const secondDest = {} as AudioNode;

    scheduleBassNote(firstDest, 110, 0, { velocity: 0.8 });
    tone.setNow(1.2);
    scheduleBassNote(secondDest, 146.83, 1.3, { velocity: 0.75 });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(2);
    expect(tone.instances[0]?.connect).toHaveBeenCalledWith(firstDest);
    expect(tone.instances[1]?.connect).toHaveBeenCalledWith(secondDest);
  });

  it("skips zero-velocity notes (no synth constructed)", () => {
    scheduleBassNote(
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

  it("cancel() prevents a future-scheduled note from ever being attacked", async () => {
    const handle = scheduleBassNote({} as AudioNode, 110, 2, { velocity: 0.8 });

    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    expect(spies.playbackAttackRelease).not.toHaveBeenCalled();

    handle.cancel();
    await vi.advanceTimersByTimeAsync(2_500);
    tone.setNow(2.5);

    expect(spies.playbackAttackRelease).not.toHaveBeenCalled();
  });

  it("cancel() is idempotent — repeated calls schedule release/dispose only once", () => {
    const handle = scheduleBassNote(
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
