import { describe, it, expect } from "vitest";
import { strumVoice, STRUM_LAG_SECONDS } from "./strumVoice";

describe("strumVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(strumVoice.scheduleChord).toBeTypeOf("function");
  });

  it("exports STRUM_LAG_SECONDS constant", () => {
    expect(STRUM_LAG_SECONDS).toBe(0.018);
  });
});
