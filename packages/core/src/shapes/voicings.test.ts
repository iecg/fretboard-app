import { describe, it, expect } from "vitest";
import {
  generateVoicings,
  CLOSE_VOICING_SPAN_LIMIT,
  scoreCloseVoicing,
  compareCloseVoicings,
  CLOSE_VOICING_SCORE_WEIGHTS,
  HIGH_NECK_THRESHOLD,
  type VoicingType,
  type Voicing,
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

describe("Voicing Generation Caching", () => {
  it("retrieves voicings from memory cache if parameters are identical", () => {
    const params = {
      chordRoot: "C",
      chordType: "maj7",
      tuning: ["E4", "B3", "G3", "D3", "A2", "E2"],
      maxFret: 24,
      voicingType: "close" as const,
    };

    const firstResult = generateVoicings(params);
    const secondResult = generateVoicings(params);
    
    // They must point to the exact same array reference in memory
    expect(firstResult).toBe(secondResult);
  });
});

describe("Voicing Search Space Complexity Scaling Guardrail", () => {
  it("bounds voicing search space linearly relative to fretboard size, preventing exponential scaling", () => {
    const baseParams = {
      chordRoot: "C",
      chordType: "M",
      tuning: ["E4", "B3", "G3", "D3", "A2", "E2"],
      maxFret: 12, // 1x scale: 12 frets
      voicingType: "close" as const,
    };

    const doubleParams = {
      ...baseParams,
      maxFret: 24, // 2x scale: 24 frets (doubled fret range)
    };

    const baseResult = generateVoicings(baseParams);
    const doubleResult = generateVoicings(doubleParams);

    // Linear scaling constraint: doubling the fretboard range must scale results <= 2.2x
    expect(doubleResult.length).toBeLessThanOrEqual(baseResult.length * 2.2);
  });
});

// frets: [stringIndex, fretIndex][] — noteName/midi are irrelevant to scoring.
function vc(frets: Array<[number, number]>): Voicing {
  return {
    positionKeys: frets.map(([s, f]) => `${s}-${f}`),
    notes: frets.map(([s, f]) => ({ stringIndex: s, fretIndex: f, noteName: "X", midi: 0 })),
  };
}

describe("scoreCloseVoicing", () => {
  it("exposes named weights and the high-neck threshold", () => {
    expect(CLOSE_VOICING_SCORE_WEIGHTS.span).toBe(3);
    expect(CLOSE_VOICING_SCORE_WEIGHTS.open).toBe(1.5);
    expect(HIGH_NECK_THRESHOLD).toBe(7);
  });

  it("prefers a compact low grip over a wide high stretch", () => {
    const compactLow = vc([[0, 1], [1, 2], [2, 2]]);
    const wideHigh = vc([[0, 12], [1, 16], [2, 14]]);
    expect(scoreCloseVoicing(compactLow)).toBeLessThan(scoreCloseVoicing(wideHigh));
  });

  it("rewards open strings over a fully fretted equivalent", () => {
    const withOpen = vc([[0, 0], [1, 2], [2, 2]]);
    const allFretted = vc([[0, 2], [1, 2], [2, 2]]);
    expect(scoreCloseVoicing(withOpen)).toBeLessThan(scoreCloseVoicing(allFretted));
  });
});

describe("compareCloseVoicings tie-break", () => {
  it("breaks equal scores by lower top fret", () => {
    const low = vc([[0, 1], [1, 2], [2, 2]]);
    const high = vc([[0, 3], [1, 4], [2, 4]]); // same shape, shifted up — equal score
    expect(scoreCloseVoicing(low)).toBe(scoreCloseVoicing(high));
    expect(compareCloseVoicings(low, high)).toBeLessThan(0);
  });

  it("then breaks ties by lower lowest-string index", () => {
    const lowStrings = vc([[0, 2], [1, 3], [2, 3]]);
    const highStrings = vc([[3, 2], [4, 3], [5, 3]]); // identical frets, higher strings
    expect(scoreCloseVoicing(lowStrings)).toBe(scoreCloseVoicing(highStrings));
    expect(compareCloseVoicings(lowStrings, highStrings)).toBeLessThan(0);
  });
});

