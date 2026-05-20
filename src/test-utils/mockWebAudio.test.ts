import { describe, it, expect, vi } from "vitest";
import { createMockGain, createMockOsc } from "./mockWebAudio";

describe("createMockGain", () => {
  it("returns a GainNode-shaped object with instrumented methods", () => {
    const gain = createMockGain();
    expect(gain.gain.value).toBe(1);
    expect(typeof gain.gain.setValueAtTime).toBe("function");
    expect(typeof gain.connect).toBe("function");
    expect(typeof gain.disconnect).toBe("function");
    expect(vi.isMockFunction(gain.gain.setValueAtTime)).toBe(true);
  });

  it("supports chained connect calls", () => {
    const a = createMockGain();
    const b = createMockGain();
    expect(a.connect(b)).toBe(b);
  });
});

describe("createMockOsc", () => {
  it("returns an OscillatorNode-shaped object", () => {
    const osc = createMockOsc();
    expect(osc.frequency.value).toBe(440);
    expect(osc.detune.value).toBe(0);
    expect(typeof osc.start).toBe("function");
    expect(typeof osc.stop).toBe("function");
    expect(typeof osc.setPeriodicWave).toBe("function");
    expect(osc.type).toBe("sine");
  });
});
