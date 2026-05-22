import { describe, it, expect } from "vitest";
import { generateVoicings, type VoicingType } from "./voicings";

const STD_TUNING = ["E4", "B3", "G3", "D3", "A2", "E2"];

describe("generateVoicings — v2.0", () => {
  it("VoicingType is the 'off' | 'full' | 'close' union", () => {
    const probe = (v: VoicingType): VoicingType => v;
    probe("off");
    probe("full");
    probe("close");
    // @ts-expect-error — drop2 retired in v2.0
    probe("drop2");
    // @ts-expect-error — triad retired in v2.0
    probe("triad");
    // @ts-expect-error — caged retired (renamed to full) in v2.0
    probe("caged");
  });

  it("returns [] when voicingType is 'off'", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "Major Triad",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "off",
    });
    expect(result).toEqual([]);
  });

  it("'full' returns the CAGED-style full-chord matches (renamed from v1 'caged')", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "Major Triad",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "full",
    });
    // C major has 5 CAGED shapes — each should produce one voicing.
    expect(result.length).toBeGreaterThanOrEqual(5);
    // Every Full voicing carries a CAGED shape annotation.
    expect(result.every((v) => v.shape !== undefined)).toBe(true);
  });

  it("'close' returns 3-string adjacent polygons for a triad", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "Major Triad",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "close",
    });
    expect(result.length).toBeGreaterThan(0);
    // Every Close voicing has exactly 3 notes for a triad.
    for (const v of result) {
      expect(v.notes.length).toBe(3);
      // Three adjacent strings.
      const strings = v.notes.map((n) => n.stringIndex).sort();
      expect(strings[2] - strings[0]).toBe(2);
    }
  });

  it("'close' returns 4-string adjacent polygons for a tetrad (Maj7)", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "Major 7th",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "close",
    });
    expect(result.length).toBeGreaterThan(0);
    for (const v of result) {
      expect(v.notes.length).toBe(4);
      const strings = v.notes.map((n) => n.stringIndex).sort();
      expect(strings[3] - strings[0]).toBe(3);
    }
  });
});
