import { describe, it, expect } from "vitest";
import { getNoteFrequency } from "@fretflow/core";
import { strumVoice, STRUM_LAG_SECONDS } from "./strumVoice";
import {
  buildMockCtx,
  createMockGain,
} from "../../../test-utils/mockWebAudio";

describe("strumVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(strumVoice.scheduleChord).toBeTypeOf("function");
  });

  it("exports STRUM_LAG_SECONDS constant", () => {
    expect(STRUM_LAG_SECONDS).toBe(0.018);
  });

  it("strums low-to-high by default (down-stroke)", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();
    const notes = ["C3", "E3", "G3"];

    strumVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      notes,
      0,
      { velocity: 0.8 },
    );

    const freqs = ctx.created.oscillators.map(
      (osc) => osc.frequency.setValueAtTime.mock.calls[0]?.[0],
    );
    expect(freqs).toEqual(notes.map((n) => getNoteFrequency(n)));
  });

  it("reverses voicing order for an up-strum", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();
    const notes = ["C3", "E3", "G3"];

    strumVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      notes,
      0,
      { velocity: 0.8, direction: "up" },
    );

    const oscillators = ctx.created.oscillators;
    expect(oscillators).toHaveLength(3);

    // First scheduled note is the LAST note of the input array.
    const firstFreq = oscillators[0].frequency.setValueAtTime.mock.calls[0]?.[0];
    expect(firstFreq).toBe(getNoteFrequency("G3"));

    const freqs = oscillators.map(
      (osc) => osc.frequency.setValueAtTime.mock.calls[0]?.[0],
    );
    expect(freqs).toEqual([
      getNoteFrequency("G3"),
      getNoteFrequency("E3"),
      getNoteFrequency("C3"),
    ]);
  });
});
