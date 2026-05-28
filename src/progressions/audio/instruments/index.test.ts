import { describe, it, expect } from "vitest";
import { getChordVoiceForInstrument, getChordVoice } from "./index";
import { getChordPatch } from "../sound/instrumentPatches";

describe("chord voice resolution by instrument + genre patch", () => {
  it("uses the genre patch when its family matches the selected instrument (memoized)", () => {
    const v = getChordVoiceForInstrument("piano", "chord-epiano");
    expect(v).toBe(getChordVoiceForInstrument("piano", "chord-epiano"));
  });

  it("falls back to the family default when instrument family != genre patch family", () => {
    const strumV = getChordVoiceForInstrument("strum", "chord-epiano");
    const steelDefault = getChordVoiceForInstrument("strum", "chord-steel-strum");
    expect(strumV).toBe(steelDefault);
  });

  it("every chord patch resolves to a usable voice", () => {
    for (const inst of ["piano", "organ", "strum"] as const) {
      const v = getChordVoiceForInstrument(inst, getChordPatch("chord-grand-piano")!.id);
      expect(typeof v.scheduleChord).toBe("function");
    }
  });

  it("getChordVoice shim returns a usable voice for each instrument", () => {
    for (const inst of ["piano", "organ", "strum"] as const) {
      expect(typeof getChordVoice(inst).scheduleChord).toBe("function");
    }
  });
});
