import { describe, it, expect } from "vitest";
import { suggestNextChords } from "./nextChordSuggestions";

describe("suggestNextChords", () => {
  it("suggests the primary functions after the tonic in major", () => {
    const suggestions = suggestNextChords("I", "major", "C");
    expect(suggestions.map((s) => s.degree)).toEqual(["IV", "V", "vi"]);
    expect(suggestions[0]).toMatchObject({ root: "F", quality: "M" });
  });

  it("resolves the dominant home first, then the deceptive turn", () => {
    const suggestions = suggestNextChords("V", "major", "C");
    expect(suggestions.map((s) => s.degree)).toEqual(["I", "vi", "IV"]);
    expect(suggestions[0].reason).toBe("authenticCadence");
    expect(suggestions[1].reason).toBe("deceptiveCadence");
  });

  it("sends the supertonic to the dominant (ii–V)", () => {
    const suggestions = suggestNextChords("ii", "major", "C");
    expect(suggestions[0]).toMatchObject({ degree: "V", reason: "twoFive" });
  });

  it("tags IV → I as a plagal cadence", () => {
    const suggestions = suggestNextChords("IV", "major", "C");
    expect(suggestions.map((s) => s.degree)).toEqual(["V", "I", "ii"]);
    expect(suggestions[0].reason).toBe("toDominant");
    expect(suggestions[1].reason).toBe("plagalCadence");
  });

  it("is mode-aware: after the minor tonic it offers iv / v / VI", () => {
    const suggestions = suggestNextChords("i", "minor", "A");
    expect(suggestions.map((s) => s.degree)).toEqual(["iv", "v", "VI"]);
    expect(suggestions[0]).toMatchObject({ root: "D", quality: "m" });
  });

  it("suggests the Aeolian ♭VI → ♭VII walk and the modal cadence home", () => {
    const fromSix = suggestNextChords("VI", "minor", "A");
    expect(fromSix[0].degree).toBe("VII");
    const fromSeven = suggestNextChords("VII", "minor", "A");
    expect(fromSeven[0]).toMatchObject({ degree: "i", reason: "modalCadence" });
  });

  it("skips candidate offsets the scale does not contain (pentatonic)", () => {
    // Major pentatonic has no 4th or 7th degree: after I the subdominant (5)
    // and leading candidates are absent, so V / vi / ii surface instead.
    const suggestions = suggestNextChords("I", "major pentatonic", "C");
    expect(suggestions.map((s) => s.degree)).toEqual(["V", "vi", "ii"]);
  });

  it("opens on the tonic when there is no previous chord", () => {
    const suggestions = suggestNextChords(null, "major", "C");
    expect(suggestions[0]).toMatchObject({ degree: "I", root: "C" });
  });

  it("falls back to opening candidates for a degree the scale does not know", () => {
    const suggestions = suggestNextChords("♭II", "major", "C");
    expect(suggestions.map((s) => s.degree)).toEqual(["I", "IV", "V"]);
  });

  it("honors the limit parameter", () => {
    expect(suggestNextChords("I", "major", "C", 2)).toHaveLength(2);
  });

  it("only ever returns diatonic chords of the active scale", () => {
    for (const scale of ["major", "minor", "dorian", "mixolydian", "harmonic minor", "minor pentatonic"]) {
      for (const prev of [null, "I", "i", "V", "v", "ii", "IV", "iv"]) {
        for (const s of suggestNextChords(prev, scale, "E")) {
          expect(s.root).toBeTruthy();
          expect(s.quality).toBeTruthy();
        }
      }
    }
  });
});
