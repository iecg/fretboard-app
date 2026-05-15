import { describe, it, expect } from "vitest";
import { getChordVoice } from "./index";

describe("getChordVoice", () => {
  it("returns strum voice for 'strum'", () => {
    const voice = getChordVoice("strum");
    expect(voice.scheduleChord).toBeTypeOf("function");
  });

  it("returns piano voice for 'piano'", () => {
    const voice = getChordVoice("piano");
    expect(voice.scheduleChord).toBeTypeOf("function");
  });

  it("returns organ voice for 'organ'", () => {
    const voice = getChordVoice("organ");
    expect(voice.scheduleChord).toBeTypeOf("function");
  });

  it("returns different instances for different ids", () => {
    expect(getChordVoice("strum")).not.toBe(getChordVoice("piano"));
    expect(getChordVoice("piano")).not.toBe(getChordVoice("organ"));
  });
});
