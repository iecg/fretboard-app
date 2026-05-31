import { describe, it, expect, beforeEach, vi } from "vitest";
import { getNoteFrequency } from "@fretflow/core";
import type { StrumSpec } from "../sound/patchTypes";

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

import { createStrumVoice, STRUM_LAG_SECONDS } from "./strumVoice";

describe("strumVoice", () => {
  let strumVoice: ReturnType<typeof createStrumVoice>;

  beforeEach(() => {
    pluckStringSpy.mockClear();
    strumVoice = createStrumVoice();
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

  it("forwards durationSec to pluckString when provided", () => {
    strumVoice.scheduleChord(
      {} as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8, durationSec: 0.06 },
    );
    for (const call of pluckStringSpy.mock.calls) {
      expect((call[3] as { durationSec?: number }).durationSec).toBe(0.06);
    }
  });

  it("omits durationSec when not provided (defaults preserved)", () => {
    strumVoice.scheduleChord({} as AudioNode, ["C3"], 0, { velocity: 0.8 });
    expect((pluckStringSpy.mock.calls[0]![3] as { durationSec?: number }).durationSec).toBeUndefined();
  });

  it("uses the spec's strumLagSec override for the per-note stagger", () => {
    const spec: StrumSpec = { strumLagSec: 0.005, noteDurationSec: 0.18, releaseTailSec: 0.4 };
    const tight = createStrumVoice(spec);
    tight.scheduleChord({} as AudioNode, ["C3", "E3", "G3"], 0, { velocity: 0.8 });
    // pluckString(dest, freq, time, options) — time is arg[2].
    const times = pluckStringSpy.mock.calls.map((c) => c[2]);
    expect(times).toEqual([0, 0.005, 0.01]);
  });
});
