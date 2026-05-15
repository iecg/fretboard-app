import { describe, it, expect } from "vitest";
import { pianoVoice } from "./pianoVoice";

describe("pianoVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(pianoVoice.scheduleChord).toBeTypeOf("function");
  });
});
