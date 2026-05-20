import { describe, it, expect } from "vitest";
import { pianoVoice } from "./pianoVoice";
import {
  buildMockCtx,
  createMockGain,
} from "../../../test-utils/mockWebAudio";

describe("pianoVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(pianoVoice.scheduleChord).toBeTypeOf("function");
  });

  it("scheduleChord returns a VoiceHandle with a cancel function", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();

    const handle = pianoVoice.scheduleChord(
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

    pianoVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8 },
    );

    expect(ctx.created.oscillators.length).toBeGreaterThan(0);
  });

  it("calling cancel() does not throw", () => {
    const ctx = buildMockCtx();
    const bus = createMockGain();

    const handle = pianoVoice.scheduleChord(
      ctx as unknown as AudioContext,
      bus as unknown as AudioNode,
      ["C3", "E3", "G3"],
      0,
      { velocity: 0.8 },
    );

    expect(() => handle.cancel()).not.toThrow();
  });
});
