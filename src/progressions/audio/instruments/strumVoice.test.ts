import { describe, it, expect, beforeEach, vi } from "vitest";
import { getNoteFrequency } from "@fretflow/core";

// After the Tone.PluckSynth migration, `pluckString` no longer creates raw
// oscillators we can count. Mock it with a spy so we can assert on the
// (ctx, dest, freq, time, options) tuples strumVoice schedules. Typed loosely
// so the spy's call args remain inspectable by index.
const pluckStringSpy = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => { cancel: () => void }>(() => ({
    cancel: vi.fn(),
  })),
);
vi.mock("../string", () => ({
  pluckString: pluckStringSpy,
}));

import { strumVoice, STRUM_LAG_SECONDS } from "./strumVoice";

describe("strumVoice", () => {
  beforeEach(() => {
    pluckStringSpy.mockClear();
  });

  it("implements ChordVoice interface", () => {
    expect(strumVoice.scheduleChord).toBeTypeOf("function");
  });

  it("exports STRUM_LAG_SECONDS constant", () => {
    expect(STRUM_LAG_SECONDS).toBe(0.018);
  });

  it("strums low-to-high by default (down-stroke)", () => {
    strumVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8 },
    );
    expect(pluckStringSpy).toHaveBeenCalledTimes(3);
    // pluckString(dest, freq, time, options) — freq is arg[1].
    const freqs = pluckStringSpy.mock.calls.map((c) => c[1]);
    expect(freqs).toEqual(["C3", "E3", "G3"].map(getNoteFrequency));
  });

  it("reverses voicing order for an up-strum", () => {
    strumVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8, direction: "up" },
    );
    expect(pluckStringSpy).toHaveBeenCalledTimes(3);
    const freqs = pluckStringSpy.mock.calls.map((c) => c[1]);
    expect(freqs).toEqual(["G3", "E3", "C3"].map(getNoteFrequency));
  });

  it("staggers strums by STRUM_LAG_SECONDS", () => {
    strumVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      1.0,
      { velocity: 0.8 },
    );
    // pluckString(dest, freq, time, options) — time is arg[2].
    const times = pluckStringSpy.mock.calls.map((c) => c[2]);
    expect(times[0]).toBeCloseTo(1.0, 4);
    expect(times[1]).toBeCloseTo(1.0 + STRUM_LAG_SECONDS, 4);
    expect(times[2]).toBeCloseTo(1.0 + 2 * STRUM_LAG_SECONDS, 4);
  });
});
