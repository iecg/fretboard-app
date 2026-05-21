import { describe, it, expect, vi, beforeEach } from "vitest";

const triggerAttackReleaseSpy = vi.hoisted(() => vi.fn());
const synthCtorSpy = vi.hoisted(() => vi.fn());
const connectSpy = vi.hoisted(() => vi.fn().mockReturnThis());
const disposeSpy = vi.hoisted(() => vi.fn());

vi.mock("tone", () => ({
  Synth: synthCtorSpy.mockImplementation(function () {
    return {
      triggerAttackRelease: triggerAttackReleaseSpy,
      connect: connectSpy,
      dispose: disposeSpy,
      volume: { value: 0 },
    };
  }),
  gainToDb: (g: number) => 20 * Math.log10(Math.max(1e-6, g)),
}));

import { scheduleClick } from "./metronome";

describe("scheduleClick — Tone backend", () => {
  beforeEach(() => {
    triggerAttackReleaseSpy.mockReset();
    connectSpy.mockReset().mockReturnThis();
    disposeSpy.mockReset();
    // Re-install the constructor implementation — `mockReset` on the ctor
    // spy strips its `mockImplementation`, so we restore it (and clear call
    // history) before each test.
    synthCtorSpy.mockReset().mockImplementation(function () {
      return {
        triggerAttackRelease: triggerAttackReleaseSpy,
        connect: connectSpy,
        dispose: disposeSpy,
        volume: { value: 0 },
      };
    });
  });

  it("triggers an accented click at 1500 Hz on beat 1", () => {
    const ctx = { currentTime: 0 } as AudioContext;
    const dest = {} as AudioNode;
    scheduleClick(ctx, dest, 1.5, { accent: true, velocity: 0.8 });
    expect(triggerAttackReleaseSpy).toHaveBeenCalledTimes(1);
    const [pitch, duration, time, velocity] = triggerAttackReleaseSpy.mock.calls[0]!;
    expect(pitch).toBeCloseTo(1500, 0);
    expect(duration).toBeCloseTo(0.04, 2);
    expect(time).toBeCloseTo(1.5, 3);
    expect(velocity).toBeCloseTo(0.8, 2);
  });

  it("triggers a normal click at 900 Hz when accent is false", () => {
    scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, { accent: false });
    expect(triggerAttackReleaseSpy.mock.calls[0]![0]).toBeCloseTo(900, 0);
  });

  it("skips scheduling when velocity is zero", () => {
    scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, { velocity: 0 });
    expect(triggerAttackReleaseSpy).not.toHaveBeenCalled();
  });

  it("cancel() disposes the synth", () => {
    const handle = scheduleClick({ currentTime: 0 } as AudioContext, {} as AudioNode, 0, {});
    handle.cancel();
    expect(disposeSpy).toHaveBeenCalled();
  });
});
