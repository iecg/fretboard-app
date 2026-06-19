import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted lifts this above the vi.mock("tone", ...) factory so the spies
// the factory wires into the mock module are the same ones the test body
// asserts against. The dynamic import inside the async hoisted block keeps
// the helper module out of the test's static import graph (which Vitest
// would otherwise evaluate AFTER hoisting, defeating the purpose).
const synth = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const s = await synth;
  return {
    Synth: s.spies.ctorSpy,
    now: () => s.now(),
    gainToDb: (g: number) => 20 * Math.log10(Math.max(1e-6, g)),
  };
});

describe("scheduleClick — Tone backend", () => {
  let spies: Awaited<typeof synth>["spies"];
  let tone: Awaited<typeof synth>;
  let scheduleClick: typeof import("./metronome").scheduleClick;

  beforeEach(async () => {
    tone = await synth;
    spies = tone.spies;
    vi.useFakeTimers();
    tone.reset();
    vi.resetModules();
    ({ scheduleClick } = await import("./metronome"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("triggers an accented click at 1500 Hz on beat 1", () => {
    const dest = {} as AudioNode;
    scheduleClick(dest, 1.5, { accent: true, velocity: 0.8 });
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    const [pitch, duration, time, velocity] = spies.triggerAttackRelease.mock.calls[0]!;
    expect(pitch).toBeCloseTo(1500, 0);
    expect(duration).toBeCloseTo(0.04, 2);
    expect(time).toBeCloseTo(1.5, 3);
    expect(velocity).toBeCloseTo(0.8, 2);
  });

  it("triggers a normal click at 900 Hz when accent is false", () => {
    scheduleClick({} as AudioNode, 0, { accent: false });
    expect(spies.triggerAttackRelease.mock.calls[0]![0]).toBeCloseTo(900, 0);
  });

  it("reuses one Synth for non-overlapping clicks on the same destination", () => {
    const dest = {} as AudioNode;
    scheduleClick(dest, 0, { accent: true, velocity: 0.8 });
    tone.setNow(0.2);
    scheduleClick(dest, 0.25, { accent: false, velocity: 0.7 });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
  });

  it("reuses the same Synth for future clicks scheduled in one pass", () => {
    const dest = {} as AudioNode;
    scheduleClick(dest, 2, { accent: true, velocity: 0.8 });
    scheduleClick(dest, 2.5, { accent: false, velocity: 0.7 });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(2);
  });

  it("connects the same synth to a new destination", () => {
    const firstDest = {} as AudioNode;
    const secondDest = {} as AudioNode;

    scheduleClick(firstDest, 0, { accent: true, velocity: 0.8 });
    tone.setNow(0.2);
    scheduleClick(secondDest, 0.25, { accent: false, velocity: 0.7 });

    expect(spies.ctorSpy).toHaveBeenCalledTimes(1);
    expect(tone.instances[0]?.connect).toHaveBeenCalledWith(firstDest);
    expect(tone.instances[0]?.connect).toHaveBeenCalledWith(secondDest);
  });

  it("skips scheduling when velocity is zero", () => {
    scheduleClick({} as AudioNode, 0, { velocity: 0 });
    expect(spies.triggerAttackRelease).not.toHaveBeenCalled();
  });

  it("cancel() triggers release on the synth", () => {
    const handle = scheduleClick({} as AudioNode, 0, {});
    handle.cancel();
    // Release fires immediately so the envelope can decay naturally.
    expect(spies.triggerRelease).toHaveBeenCalledTimes(1);
    expect(spies.dispose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(25);
    expect(spies.dispose).not.toHaveBeenCalled();
  });

  it("cancel() prevents a future-scheduled click from ever being attacked", async () => {
    const handle = scheduleClick({} as AudioNode, 2, { accent: true, velocity: 0.8 });

    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    expect(spies.playbackAttackRelease).not.toHaveBeenCalled();

    handle.cancel();
    await vi.advanceTimersByTimeAsync(2_500);
    tone.setNow(2.5);

    expect(spies.playbackAttackRelease).not.toHaveBeenCalled();
  });

  it("cancel() is idempotent — repeated calls trigger release only once", () => {
    const handle = scheduleClick({} as AudioNode, 0, {});
    handle.cancel();
    handle.cancel();
    handle.cancel();
    expect(spies.triggerRelease).toHaveBeenCalledTimes(1);
  });
});
