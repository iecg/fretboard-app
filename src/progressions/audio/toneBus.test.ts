import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Tone first so the module under test sees the spy.
const setContextSpy = vi.hoisted(() => vi.fn());
const getContextSpy = vi.hoisted(() => vi.fn());

vi.mock("tone", () => ({
  setContext: setContextSpy,
  getContext: getContextSpy,
}));

import { _resetProgressionAudioForTests, ensureProgressionAudio } from "./bus";
import { _resetToneBusForTests } from "./toneBus";

describe("toneBus binding", () => {
  beforeEach(() => {
    _resetProgressionAudioForTests();
    _resetToneBusForTests();
    setContextSpy.mockReset();
    getContextSpy.mockReset();
    // Minimal AudioContext stub so ensureProgressionAudio() succeeds in jsdom.
    (window as unknown as { AudioContext: unknown }).AudioContext = vi.fn(function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect: vi.fn() }),
        destination: {},
        currentTime: 0,
        state: "running",
      };
    }) as unknown as typeof AudioContext;
  });

  it("calls Tone.setContext with the shared AudioContext on first ensureProgressionAudio", () => {
    const audio = ensureProgressionAudio();
    expect(audio).not.toBeNull();
    expect(setContextSpy).toHaveBeenCalledTimes(1);
    // Tone.setContext receives the same ctx that bus.ts created.
    expect(setContextSpy.mock.calls[0]![0]).toBe(audio!.ctx);
  });

  it("does not re-bind Tone on subsequent ensureProgressionAudio calls", () => {
    ensureProgressionAudio();
    ensureProgressionAudio();
    ensureProgressionAudio();
    expect(setContextSpy).toHaveBeenCalledTimes(1);
  });
});
