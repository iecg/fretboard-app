import { describe, it, expect, vi } from "vitest";
import { organVoice } from "./organVoice";

// Minimal Web Audio mock — tracks node creation so we can assert that
// scheduling a chord actually builds oscillators.
function createMockGain() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };
}

function createMockOsc() {
  return {
    type: "sine" as OscillatorType,
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as null | (() => void),
  };
}

function buildMockCtx() {
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    createGain: vi.fn(createMockGain),
    createOscillator: vi.fn(createMockOsc),
  };
  return ctx;
}

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

    expect(ctx.createOscillator).toHaveBeenCalled();
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
