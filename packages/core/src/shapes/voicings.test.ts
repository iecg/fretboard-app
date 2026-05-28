import { describe, it, expect } from "vitest";
import {
  generateVoicings,
  CLOSE_VOICING_SPAN_LIMIT,
  type VoicingType,
} from "./voicings";
import { NOTES } from "../theory";

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
      chordType: "M",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "off",
    });
    expect(result).toEqual([]);
  });

  it("'full' returns the CAGED-style full-chord matches (renamed from v1 'caged')", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "M",
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
      chordType: "M",
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
      chordType: "maj7",
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

  it("'close' returns [] for chord types with <3 members (dyad: Power Chord)", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "5",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "close",
    });
    expect(result).toEqual([]);
  });

  it("'close' returns [] when tuning.length !== 6", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "M",
      tuning: ["E4", "B3", "G3", "D3", "A2"], // 5-string tuning
      maxFret: 24,
      voicingType: "close",
    });
    expect(result).toEqual([]);
  });

  it("'close' returns [] for an unknown chord type", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "Not A Chord",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "close",
    });
    expect(result).toEqual([]);
  });

  it("'close' triad contains all three chord pitch classes (C major: {0, 4, 7})", () => {
    const result = generateVoicings({
      chordRoot: "C",
      chordType: "M",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "close",
    });
    expect(result.length).toBeGreaterThan(0);
    const expectedPCs = new Set([0, 4, 7]);
    for (const v of result) {
      const pcs = new Set(v.notes.map((n) => n.midi % 12));
      expect(pcs).toEqual(expectedPCs);
    }
  });
});

describe("closeVoicings — open-string filter", () => {
  it("includes open-string voicings for chords in low position", () => {
    // G major in close voicing: should produce at least one voicing with the open G string.
    // STD_TUNING = ["E4", "B3", "G3", "D3", "A2", "E2"]; G3 is stringIndex 2.
    const voicings = generateVoicings({
      chordRoot: "G",
      chordType: "M",
      tuning: STD_TUNING,
      maxFret: 12,
      voicingType: "close",
    });
    const hasOpenG = voicings.some((v) =>
      v.notes.some((n) => n.fretIndex === 0 && n.stringIndex === 2 /* G string */),
    );
    expect(hasOpenG).toBe(true);
  });

  it("does not produce voicings mixing open strings with frets >= 5", () => {
    const voicings = generateVoicings({
      chordRoot: "G",
      chordType: "M",
      tuning: STD_TUNING,
      maxFret: 15,
      voicingType: "close",
    });
    for (const v of voicings) {
      const hasOpen = v.notes.some((n) => n.fretIndex === 0);
      if (!hasOpen) continue;
      const maxFret = Math.max(...v.notes.map((n) => n.fretIndex));
      expect(maxFret).toBeLessThan(5);
    }
  });
});

describe("closeVoicings span cap", () => {
  it("exports CLOSE_VOICING_SPAN_LIMIT as 3", () => {
    expect(CLOSE_VOICING_SPAN_LIMIT).toBe(3);
  });

  it("never emits a candidate whose fretted-fret span exceeds the cap", () => {
    const allChords = [
      "M",
      "m",
      "7",
      "maj7",
    ] as const;
    for (const chordType of allChords) {
      for (const chordRoot of NOTES) {
        const voicings = generateVoicings({
          chordRoot,
          chordType,
          tuning: STD_TUNING,
          maxFret: 24,
          voicingType: "close",
        });
        for (const v of voicings) {
          const fretted = v.notes.map((n) => n.fretIndex).filter((f) => f > 0);
          if (fretted.length < 2) continue;
          const span = Math.max(...fretted) - Math.min(...fretted);
          expect(
            span,
            `${chordRoot} ${chordType}: ${JSON.stringify(
              v.positionKeys,
            )} span=${span}`,
          ).toBeLessThanOrEqual(CLOSE_VOICING_SPAN_LIMIT);
        }
      }
    }
  });

  it("emits at least one close voicing for C7 standard tuning", () => {
    const voicings = generateVoicings({
      chordRoot: "C",
      chordType: "7",
      tuning: STD_TUNING,
      maxFret: 24,
      voicingType: "close",
    });
    expect(voicings.length).toBeGreaterThan(0);
  });
});
