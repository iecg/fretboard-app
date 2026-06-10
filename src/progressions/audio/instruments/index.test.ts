import { describe, it, expect } from "vitest";
import { getChordVoiceForInstrument } from "./index";
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

  it("prefers the genre alt patch when it matches the selected family", () => {
    // Blues-style config: strum default + organ alt. Selecting a keys
    // instrument resolves to the alt (organ), not the family fallback (piano).
    const organ = getChordVoiceForInstrument("organ", "chord-steel-strum", "chord-jazz-organ");
    const organDirect = getChordVoiceForInstrument("organ", "chord-jazz-organ");
    expect(organ).toBe(organDirect);
  });

  it("uses the primary patch when it matches the selected family, ignoring the alt", () => {
    const strum = getChordVoiceForInstrument("strum", "chord-steel-strum", "chord-jazz-organ");
    const strumDirect = getChordVoiceForInstrument("strum", "chord-steel-strum");
    expect(strum).toBe(strumDirect);
  });

  it("falls back to the family default when neither primary nor alt matches the family", () => {
    // Both patches are poly; selecting strum matches neither → steel default.
    const strum = getChordVoiceForInstrument("strum", "chord-epiano", "chord-jazz-organ");
    const steelDefault = getChordVoiceForInstrument("strum", "chord-steel-strum");
    expect(strum).toBe(steelDefault);
  });

});
