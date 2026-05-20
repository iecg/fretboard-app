import { describe, it, expect, vi } from "vitest";
import {
  createMockGain,
  createMockOsc,
  createMockFilter,
  createMockBufferSource,
  createMockBuffer,
} from "./mockWebAudio";

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

describe("createMockFilter", () => {
  it("returns a BiquadFilterNode-shaped object", () => {
    const f = createMockFilter();
    expect(f.type).toBe("lowpass");
    expect(f.frequency.value).toBe(350);
    expect(f.Q.value).toBe(1);
    expect(typeof f.connect).toBe("function");
  });
});

describe("createMockBufferSource", () => {
  it("returns an AudioBufferSourceNode-shaped object", () => {
    const s = createMockBufferSource();
    expect(s.buffer).toBeNull();
    expect(typeof s.start).toBe("function");
    expect(typeof s.stop).toBe("function");
  });
});

describe("createMockBuffer", () => {
  it("returns an AudioBuffer-shaped object with sane defaults", () => {
    const b = createMockBuffer({ length: 4, sampleRate: 44100, numberOfChannels: 1 });
    expect(b.length).toBe(4);
    expect(b.sampleRate).toBe(44100);
    expect(b.numberOfChannels).toBe(1);
    expect(b.getChannelData(0)).toBeInstanceOf(Float32Array);
    expect(b.getChannelData(0).length).toBe(4);
  });
});
