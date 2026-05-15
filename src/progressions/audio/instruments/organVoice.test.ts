import { describe, it, expect } from "vitest";
import { organVoice } from "./organVoice";

describe("organVoice", () => {
  it("implements ChordVoice interface", () => {
    expect(organVoice.scheduleChord).toBeTypeOf("function");
  });
});
