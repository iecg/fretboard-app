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
    now: () => 0,
    gainToDb: (g: number) => 20 * Math.log10(Math.max(1e-6, g)),
  };
});

import { scheduleClick } from "./metronome";

describe("scheduleClick — Tone backend", () => {
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

  it("triggers an accented click at 1500 Hz on beat 1", () => {
    const ctx = { currentTime: 0 } as AudioContext;
    const dest = {} as AudioNode;
    scheduleClick(ctx, dest, 1.5, { accent: true, velocity: 0.8 });
    expect(spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    const [pitch, duration, time, velocity] = spies.triggerAttackRelease.mock.calls[0]!;
    expect(pitch).toBeCloseTo(1500, 0);
    expect(duration).toBeCloseTo(0.04, 2);
    expect(time).toBeCloseTo(1.5, 3);
    expect(velocity).toBeCloseTo(0.8, 2);
  });

  it("triggers a normal click at 900 Hz when accent is false", () => {
    scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, { accent: false });
    expect(spies.triggerAttackRelease.mock.calls[0]![0]).toBeCloseTo(900, 0);
  });

  it("skips scheduling when velocity is zero", () => {
    scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, { velocity: 0 });
    expect(spies.triggerAttackRelease).not.toHaveBeenCalled();
  });

  it("cancel() triggers release then disposes the synth after the envelope settles", () => {
    const handle = scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, {});
    handle.cancel();
    // Release fires immediately so the envelope can decay naturally.
    expect(spies.triggerRelease).toHaveBeenCalledTimes(1);
    // Dispose is deferred via setTimeout(...20) so the release tail isn't truncated.
    expect(spies.dispose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(25);
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancel() is idempotent — repeated calls schedule release/dispose only once", () => {
    const handle = scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, {});
    handle.cancel();
    handle.cancel();
    handle.cancel();
    vi.advanceTimersByTime(25);
    expect(spies.triggerRelease).toHaveBeenCalledTimes(1);
    expect(spies.dispose).toHaveBeenCalledTimes(1);
  });
});
