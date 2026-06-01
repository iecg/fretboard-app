import { describe, expect, it } from "vitest";
import { resolveBassLineNotes, resolveChordVoicing, resolveBassNoteForRole, buildFunkColorVoicing, buildBossaColorVoicing } from "./progressionAudio";

describe("resolveChordVoicing", () => {
  it("stacks the C Major Triad as C-E-G at octave 3", () => {
    expect(resolveChordVoicing("C", "M")).toEqual(["C3", "E3", "G3"]);
  });

  it("stacks the A Minor Triad as A-C-E with octave carry", () => {
    // Root A is at chromatic index 9 in octave 3 → absolute 45. The minor
    // third (+3 semitones) wraps to C and bumps the octave to 4.
    expect(resolveChordVoicing("A", "m")).toEqual(["A3", "C4", "E4"]);
  });

  it("stacks the G Dominant 7th as G-B-D-F", () => {
    expect(resolveChordVoicing("G", "7")).toEqual([
      "G3",
      "B3",
      "D4",
      "F4",
    ]);
  });

  it("honours a custom root octave", () => {
    expect(resolveChordVoicing("C", "M", 4)).toEqual([
      "C4",
      "E4",
      "G4",
    ]);
  });

  it("returns an empty voicing for unknown qualities", () => {
    expect(resolveChordVoicing("C", "Made Up Quality")).toEqual([]);
  });

  it("returns an empty voicing for unknown roots", () => {
    expect(resolveChordVoicing("H", "M")).toEqual([]);
  });

  it("handles sharp roots and wraps the chromatic scale correctly", () => {
    // F# Major: F# A# C# — the perfect fifth from F# is C# (octave above).
    expect(resolveChordVoicing("F#", "M")).toEqual([
      "F#3",
      "A#3",
      "C#4",
    ]);
  });

  it("returns 4 notes for seventh chords", () => {
    expect(resolveChordVoicing("D", "m7")).toHaveLength(4);
  });
});

describe("resolveBassLineNotes", () => {
  it("uses the chord root and perfect fifth in the bass octave", () => {
    expect(resolveBassLineNotes("C", "M")).toEqual(["C2", "G2"]);
  });

  it("uses the altered fifth for diminished chords", () => {
    expect(resolveBassLineNotes("B", "dim")).toEqual(["B2", "F3"]);
  });
});

describe("resolveBassNoteForRole", () => {
  it("resolves root", () => {
    expect(resolveBassNoteForRole("C", "M", "root")).toBe("C2");
  });
  it("resolves third", () => {
    expect(resolveBassNoteForRole("C", "M", "third")).toBe("E2");
  });
  it("resolves fifth", () => {
    expect(resolveBassNoteForRole("C", "M", "fifth")).toBe("G1");
  });
  it("resolves octave", () => {
    expect(resolveBassNoteForRole("C", "M", "octave")).toBe("C3");
  });
  it("resolves chromatic-approach to semitone below next root", () => {
    expect(resolveBassNoteForRole("C", "M", "chromatic-approach", "F")).toBe("E2");
  });
  it("falls back to semitone below current root when no next root", () => {
    expect(resolveBassNoteForRole("C", "M", "chromatic-approach")).toBe("B1");
  });
  it("falls back to root when third/fifth unavailable", () => {
    expect(resolveBassNoteForRole("C", "5", "third")).toBe("C2");
  });
  it("resolves a flat-seventh on a major triad via the root+10 fallback", () => {
    // C major has no 7th chord member, so b7 = root + 10 semitones = A# (Bb).
    const note = resolveBassNoteForRole("C", "M", "flat-seventh");
    expect(note.replace(/[0-9]/g, "")).toBe("A#");
  });
  it("prefers the chord's own 7th member when present", () => {
    // Cmaj7's "7" member is +11 semitones = B (distinct from the +10 fallback).
    const note = resolveBassNoteForRole("C", "maj7", "flat-seventh");
    expect(note.replace(/[0-9]/g, "")).toBe("B");
  });
  it("resolves a flat-seventh on a dominant 7 chord from its b7 member", () => {
    // C7's "b7" member is +10 semitones = A#.
    const note = resolveBassNoteForRole("C", "7", "flat-seventh");
    expect(note.replace(/[0-9]/g, "")).toBe("A#");
  });
});

describe("buildFunkColorVoicing", () => {
  const PC: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  const pcSet = (notes: readonly string[]) => new Set(notes.map((n) => n.replace(/-?\d+$/, "")));
  const midi = (n: string) => { const m = n.match(/^([A-G]#?)(-?\d+)$/)!; return PC[m[1]] + (parseInt(m[2], 10) + 1) * 12; };

  it("dominant 7 grip is a rootless 3 / b7 / 9 (the E9 grip)", () => {
    const v = buildFunkColorVoicing("G", "7");
    expect(v).toHaveLength(3);
    const pcs = pcSet(v);
    expect(pcs).toEqual(new Set(["B", "F", "A"])); // 3=B, b7=F, 9=A
    expect(pcs.has("F")).toBe(true); // dominant MUST carry the b7 color
    expect(pcs.has("G")).toBe(false); // rootless — the bass covers the root
  });

  it("major grip is 3 / 6 / 9 and never adds a b7 (no tonic clash)", () => {
    const v = buildFunkColorVoicing("C", "M");
    expect(v).toHaveLength(3);
    const pcs = pcSet(v);
    expect(pcs).toEqual(new Set(["E", "A", "D"])); // 3 / 6 / 9
    expect(pcs.has("A#")).toBe(false); // clash guard: NO b7 on a major chord
    expect(pcs.has("C")).toBe(false); // rootless
  });

  it("minor grip is a rootless b3 / b7 / 9 (m9)", () => {
    const v = buildFunkColorVoicing("A", "m");
    expect(v).toHaveLength(3);
    expect(pcSet(v)).toEqual(new Set(["C", "G", "B"])); // b3=C, b7=G, 9=B
    expect(pcSet(v).has("A")).toBe(false);
  });

  it("every defined grip omits the chord root (rootless)", () => {
    for (const [root, quality] of [["C", "7"], ["D", "M"], ["E", "m"], ["F", "m7"], ["G", "maj7"]] as const) {
      expect(pcSet(buildFunkColorVoicing(root, quality)).has(root), `${root}${quality}`).toBe(false);
    }
  });

  it("spaces the grip open — no muddy low cluster (every adjacent interval >= a minor third)", () => {
    // Mud guard: close-packing (getNearestInversion) used to crunch the 9th next
    // to the 3rd/b3 as a low major-2nd/semitone (~150-195Hz) — the source of the
    // "muddy" color stabs. The open voicing keeps the 9th an octave above the 3rd,
    // so every adjacent interval stays >= 3 semitones, for ALL grips and roots.
    const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    for (const root of ROOTS) {
      for (const quality of ["7", "M", "m", "m7", "maj7"]) {
        const ms = buildFunkColorVoicing(root, quality).map(midi);
        for (let i = 1; i < ms.length; i++) {
          expect(ms[i] - ms[i - 1], `${root}${quality}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("keeps the grip in a bright but bounded register (no sub-bass, no shrill)", () => {
    for (const root of ["C", "E", "G", "A", "B"]) {
      for (const n of buildFunkColorVoicing(root, "7")) {
        const m = midi(n);
        expect(m, `${root}7 ${n}`).toBeGreaterThanOrEqual(48); // >= C3
        expect(m).toBeLessThanOrEqual(84); // <= C6
      }
    }
  });

  it("falls back to the plain voice-led triad for a quality without a grip", () => {
    // dim has no funk grip → delegates to resolveChordVoicing (the plain triad).
    expect(buildFunkColorVoicing("C", "dim")).toEqual(resolveChordVoicing("C", "dim", undefined, undefined));
  });

  it("returns [] for an unknown root", () => {
    expect(buildFunkColorVoicing("H", "7")).toEqual([]);
  });
});

describe("buildBossaColorVoicing", () => {
  const PC: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  const pcSet = (notes: readonly string[]) => new Set(notes.map((n) => n.replace(/-?\d+$/, "")));
  const midi = (n: string) => { const m = n.match(/^([A-G]#?)(-?\d+)$/)!; return PC[m[1]] + (parseInt(m[2], 10) + 1) * 12; };

  it("voices a major chord as a rootless maj9 (3 / 7 / 9) in the middle register", () => {
    expect(buildBossaColorVoicing("C", "maj7")).toEqual(["E4", "B4", "D5"]);
    expect(buildBossaColorVoicing("C", "M")).toEqual(["E4", "B4", "D5"]);
  });

  it("voices a minor 7 chord as a rootless m9 (b3 / b7 / 9)", () => {
    expect(buildBossaColorVoicing("A", "m7")).toEqual(["C5", "G5", "B5"]);
    expect(pcSet(buildBossaColorVoicing("A", "m7")).has("A")).toBe(false);
  });

  it("voices a dominant 7 chord as a rootless dom9 (3 / b7 / 9)", () => {
    const v = buildBossaColorVoicing("G", "7");
    expect(pcSet(v)).toEqual(new Set(["B", "F", "A"]));
    expect(pcSet(v).has("G")).toBe(false);
  });

  it("keeps every defined voicing rootless and in the middle register (C4..C#6)", () => {
    for (const [root, quality] of [["C", "maj7"], ["D", "M"], ["E", "m7"], ["G", "7"], ["B", "maj7"]] as const) {
      const v = buildBossaColorVoicing(root, quality);
      expect(pcSet(v).has(root), `${root}${quality} rootless`).toBe(false);
      for (const n of v) {
        const m = midi(n);
        expect(m, `${root}${quality} ${n} low`).toBeGreaterThanOrEqual(60);
        expect(m, `${root}${quality} ${n} high`).toBeLessThanOrEqual(86);
      }
    }
  });

  it("falls back to the plain voice-led triad for a quality without a grip", () => {
    expect(buildBossaColorVoicing("C", "dim")).toEqual(resolveChordVoicing("C", "dim", undefined, undefined));
  });

  it("returns [] for an unknown root", () => {
    expect(buildBossaColorVoicing("H", "maj7")).toEqual([]);
  });
});
