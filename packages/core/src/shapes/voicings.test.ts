import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "../guitar";
import {
  inversionBassPitchClass,
  openStringMidi,
  generateVoicings,
} from "./voicings";
import { getFullChordShapeMatches } from "./fullChordShapes";

describe("voicing helpers", () => {
  it("computes the inversion bass pitch class", () => {
    expect(inversionBassPitchClass("C", "Major Triad", "root")).toBe(0);
    expect(inversionBassPitchClass("C", "Major Triad", "1st")).toBe(4);
    expect(inversionBassPitchClass("C", "Major Triad", "2nd")).toBe(7);
    expect(inversionBassPitchClass("C", "Major Triad", "3rd")).toBeNull();
  });

  it("computes open-string MIDI from a tuning entry", () => {
    expect(openStringMidi("E2")).toBe(28);
    expect(openStringMidi(STANDARD_TUNING[5])).toBe(28);
    expect(openStringMidi("not-a-note")).toBeNull();
  });
});

describe("generateVoicings — explicit string set", () => {
  const base = { tuning: STANDARD_TUNING, maxFret: 12 } as const;

  it("confines a triad search to the requested string indices", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: [3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      for (const n of v.notes) {
        expect([3, 4, 5]).toContain(n.stringIndex);
      }
    }
  });

  it("returns no voicings for an impossible request", () => {
    // A 4-note chord cannot be voiced inside a 3-string window.
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "root", stringSet: [3, 4, 5],
    });
    expect(voicings).toEqual([]);
  });

  it("searches drop2 voicings on a 4-note chord across a 4-string window", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "root", stringSet: [2, 3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      for (const n of v.notes) {
        expect([2, 3, 4, 5]).toContain(n.stringIndex);
      }
    }
  });
});

describe("generateVoicings — triad", () => {
  const base = { tuning: STANDARD_TUNING, maxFret: 12 } as const;

  it("every triad voicing contains all three chord tones", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const pcs = new Set(v.notes.map((n) => n.midi % 12));
      expect(pcs).toEqual(new Set([0, 4, 7]));
    }
  });

  it("root-inversion voicings have the root as the lowest note", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    });
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(0);
    }
  });

  it("1st-inversion voicings have the 3rd as the lowest note", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "1st", stringSet: [0, 1, 2, 3, 4, 5],
    });
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(4);
    }
  });

  it("the string set restricts which strings carry notes", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: [0, 1, 2],
    });
    for (const v of voicings) {
      for (const n of v.notes) expect([0, 1, 2]).toContain(n.stringIndex);
    }
  });

  it("returns no voicing for an inversion the chord lacks", () => {
    expect(generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "3rd", stringSet: [0, 1, 2, 3, 4, 5],
    })).toEqual([]);
  });

  it("2nd-inversion voicings have the 5th as the lowest note", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "2nd", stringSet: [0, 1, 2, 3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(7);
    }
  });

  it("restricts notes to the low string set", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: [3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      for (const n of v.notes) expect([3, 4, 5]).toContain(n.stringIndex);
    }
  });

  it("returns [] for a non-6-string tuning", () => {
    expect(generateVoicings({
      tuning: ["E4", "B3", "G3", "D3", "A2"], maxFret: 12,
      chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    })).toEqual([]);
  });

  it("returns [] for an unparseable tuning entry", () => {
    expect(generateVoicings({
      tuning: ["E4", "B3", "G3", "D3", "A2", "not-a-note"], maxFret: 12,
      chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    })).toEqual([]);
  });

  it("returns [] for an unknown chord type", () => {
    expect(generateVoicings({
      ...base, chordRoot: "C", chordType: "Not A Chord",
      voicingType: "triad", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    })).toEqual([]);
  });
});

describe("generateVoicings — drop2", () => {
  it("drop2 voicings span more than an octave and contain all four tones", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 14,
      chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const midis = v.notes.map((n) => n.midi);
      expect(Math.max(...midis) - Math.min(...midis)).toBeGreaterThan(12);
      expect(new Set(v.notes.map((n) => n.midi % 12))).toEqual(new Set([0, 4, 7, 11]));
    }
  });

  it("drop2 on a plain triad produces spread voicings (pitch span > 12)", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "C", chordType: "Major Triad",
      voicingType: "drop2", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const midis = v.notes.map((n) => n.midi);
      const span = Math.max(...midis) - Math.min(...midis);
      expect(span).toBeGreaterThan(12);
    }
  });

  it("3rd-inversion drop2 voicings have the major 7th as the lowest note", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 14,
      chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "3rd", stringSet: [0, 1, 2, 3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(11);
    }
  });
});

describe("generateVoicings — triad vs drop2 on a triad chord", () => {
  const base = { tuning: STANDARD_TUNING, maxFret: 12 } as const;
  const allStrings: readonly number[] = [0, 1, 2, 3, 4, 5];

  it("triad on a triad chord stays closed (pitch span ≤ 12)", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: allStrings,
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const midis = v.notes.map((n) => n.midi);
      const span = Math.max(...midis) - Math.min(...midis);
      expect(span).toBeLessThanOrEqual(12);
    }
  });

  it("drop2 on a triad chord is always spread (pitch span > 12)", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "drop2", inversion: "root", stringSet: allStrings,
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const midis = v.notes.map((n) => n.midi);
      const span = Math.max(...midis) - Math.min(...midis);
      expect(span).toBeGreaterThan(12);
    }
  });

  it("triad and drop2 on a triad chord are not equal", () => {
    const triad = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: allStrings,
    });
    const drop2 = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "drop2", inversion: "root", stringSet: allStrings,
    });
    const triadKeys = new Set(triad.map((v) => v.positionKeys.join("|")));
    const drop2Keys = new Set(drop2.map((v) => v.positionKeys.join("|")));
    for (const k of drop2Keys) expect(triadKeys.has(k)).toBe(false);
  });
});

describe("generateVoicings — caged routing", () => {
  it("unconstrained caged matches getFullChordShapeMatches position keys", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "E", chordType: "Major Triad",
      voicingType: "caged", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    });
    const direct = getFullChordShapeMatches({
      chordRoot: "E", chordType: "Major Triad", tuning: STANDARD_TUNING, maxFret: 12,
    });
    expect(voicings.map((v) => v.positionKeys.join("|")).sort())
      .toEqual(direct.map((m) => m.positionKeys.join("|")).sort());
  });

  it("caged voicings carry their CAGED shape", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "E", chordType: "Major Triad",
      voicingType: "caged", inversion: "root", stringSet: [0, 1, 2, 3, 4, 5],
    });
    expect(voicings.length).toBeGreaterThan(0);
    expect(voicings.every((v) => v.shape !== undefined)).toBe(true);
  });

  it("caged with a string set drops voicings that use excluded strings", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "E", chordType: "Major Triad",
      voicingType: "caged", inversion: "root", stringSet: [0, 1, 2],
    });
    for (const v of voicings) {
      for (const n of v.notes) expect([0, 1, 2]).toContain(n.stringIndex);
    }
  });
});
