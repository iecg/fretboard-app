import { describe, it, expect } from "vitest";
import { organVoice } from "./organVoice";
import {
  buildMockCtx,
  createMockGain,
} from "../../../test-utils/mockWebAudio";

describe("organVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(organVoice.scheduleChord).toBeTypeOf("function");
  });

  it("scheduleChord returns a VoiceHandle with a cancel function", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();

    const handle = organVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8 },
    );

    expect(handle.cancel).toBeTypeOf("function");
  });

  it("scheduling a chord creates oscillators", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();

    organVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8 },
    );

    expect(ctx.created.oscillators.length).toBeGreaterThan(0);
  });

  it("schedules a stop for every oscillator so notes self-terminate", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();

    organVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8 },
    );

    const oscs = ctx.created.oscillators;
    expect(oscs.length).toBeGreaterThan(0);
    for (const osc of oscs) {
      expect(osc.stop).toHaveBeenCalled();
      const [stopTime] = osc.stop.mock.calls[0];
      expect(Number.isFinite(stopTime)).toBe(true);
    }
  });

  it("releases each harmonic gain back toward silence", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();

    organVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      ["C3"],
      0,
      { velocity: 0.8 },
    );

    const gains = ctx.created.gains;
    // Every harmonic gain must ramp down to a near-silent target so the
    // note ends on its own instead of sustaining at full level.
    const releasing = gains.filter((g) =>
      g.gain.exponentialRampToValueAtTime.mock.calls.some(
        ([target]: [number]) => target <= 0.01,
      ),
    );
    // One gain node is the note merger (no release ramp); every other gain
    // is a harmonic and must release.
    expect(releasing.length).toBe(gains.length - 1);
  });

  it("calling cancel() does not throw", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();

    const handle = organVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8 },
    );

    expect(() => handle.cancel()).not.toThrow();
  });
});
