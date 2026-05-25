import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedVoicings, prewarmVoicings, clearVoicingCache } from "./voicingCache";
import * as voicings from "./voicings";

describe("VoicingCache", () => {
  beforeEach(() => {
    clearVoicingCache();
    vi.restoreAllMocks();
  });

  it("caches generateVoicings calls", () => {
    const spy = vi.spyOn(voicings, "generateVoicingsUncached").mockReturnValue([]);
    
    const params = { chordRoot: "C", chordType: "M", tuning: ["E4", "B3", "G3", "D3", "A2", "E2"], maxFret: 24, voicingType: "close" as const };
    
    getCachedVoicings(params);
    getCachedVoicings(params);
    
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("prewarms the cache for multiple roots", () => {
    const spy = vi.spyOn(voicings, "generateVoicingsUncached").mockReturnValue([]);
    const tuning = ["E4", "B3", "G3", "D3", "A2", "E2"];
    
    prewarmVoicings([{ chordRoot: "C", chordType: "M" }, { chordRoot: "G", chordType: "M" }], tuning, 24);
    
    expect(spy).toHaveBeenCalledTimes(4); // full + close for each of the 2 chords
  });
});
