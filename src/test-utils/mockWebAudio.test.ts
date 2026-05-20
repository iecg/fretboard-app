import { describe, it, expect, vi } from "vitest";
import { createMockGain } from "./mockWebAudio";

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
