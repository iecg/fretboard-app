import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "../guitar";
import {
  stringSetMask,
  inversionBassPitchClass,
  openStringMidi,
  generateVoicings,
} from "./voicings";

describe("voicing helpers", () => {
  it("maps string-set ids to high→low string indices", () => {
    expect(stringSetMask("all")).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stringSetMask("low")).toEqual([3, 4, 5]);
    expect(stringSetMask("mid")).toEqual([2, 3, 4]);
    expect(stringSetMask("mid-hi")).toEqual([1, 2, 3]);
    expect(stringSetMask("top")).toEqual([0, 1, 2]);
  });

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

describe("generateVoicings — triad", () => {
  const base = { tuning: STANDARD_TUNING, maxFret: 12 } as const;

  it("every triad voicing contains all three chord tones", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: "all",
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
      voicingType: "triad", inversion: "root", stringSet: "all",
    });
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(0);
    }
  });

  it("1st-inversion voicings have the 3rd as the lowest note", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "1st", stringSet: "all",
    });
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(4);
    }
  });

  it("the string set restricts which strings carry notes", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: "top",
    });
    for (const v of voicings) {
      for (const n of v.notes) expect([0, 1, 2]).toContain(n.stringIndex);
    }
  });

  it("returns no voicing for an inversion the chord lacks", () => {
    expect(generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "3rd", stringSet: "all",
    })).toEqual([]);
  });

  it("2nd-inversion voicings have the 5th as the lowest note", () => {
    const voicings = generateVoicings({
      ...base, chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "2nd", stringSet: "all",
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
      voicingType: "triad", inversion: "root", stringSet: "low",
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
      voicingType: "triad", inversion: "root", stringSet: "all",
    })).toEqual([]);
  });

  it("returns [] for an unparseable tuning entry", () => {
    expect(generateVoicings({
      tuning: ["E4", "B3", "G3", "D3", "A2", "not-a-note"], maxFret: 12,
      chordRoot: "C", chordType: "Major Triad",
      voicingType: "triad", inversion: "root", stringSet: "all",
    })).toEqual([]);
  });

  it("returns [] for an unknown chord type", () => {
    expect(generateVoicings({
      ...base, chordRoot: "C", chordType: "Not A Chord",
      voicingType: "triad", inversion: "root", stringSet: "all",
    })).toEqual([]);
  });
});

describe("generateVoicings — drop2", () => {
  it("drop2 voicings span more than an octave and contain all four tones", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 14,
      chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "root", stringSet: "all",
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const midis = v.notes.map((n) => n.midi);
      expect(Math.max(...midis) - Math.min(...midis)).toBeGreaterThan(12);
      expect(new Set(v.notes.map((n) => n.midi % 12))).toEqual(new Set([0, 4, 7, 11]));
    }
  });

  it("drop2 on a plain triad falls back to a 3-voice voicing", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 12,
      chordRoot: "C", chordType: "Major Triad",
      voicingType: "drop2", inversion: "root", stringSet: "all",
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) expect(v.notes.length).toBe(3);
  });

  it("3rd-inversion drop2 voicings have the major 7th as the lowest note", () => {
    const voicings = generateVoicings({
      tuning: STANDARD_TUNING, maxFret: 14,
      chordRoot: "C", chordType: "Major 7th",
      voicingType: "drop2", inversion: "3rd", stringSet: "all",
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const lowest = v.notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      expect(lowest.midi % 12).toBe(11);
    }
  });
});
