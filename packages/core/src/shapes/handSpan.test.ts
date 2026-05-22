import { describe, it, expect } from "vitest";
import {
  fretPositionMm,
  voicingWidthMm,
  filterByHandSpan,
  HAND_SPAN_THRESHOLDS_MM,
  type HandSize,
} from "./handSpan";
import type { Voicing } from "./voicings";

describe("fretPositionMm", () => {
  it("places fret 0 at 0mm from the nut", () => {
    expect(fretPositionMm(0)).toBeCloseTo(0, 2);
  });

  it("places fret 12 at half the scale length on a 25.5\" guitar", () => {
    // 25.5 inches = 647.7 mm. Fret 12 = scale/2 = ~323.85 mm.
    expect(fretPositionMm(12)).toBeCloseTo(323.85, 1);
  });

  it("fret spacing shrinks logarithmically", () => {
    const between1 = fretPositionMm(2) - fretPositionMm(1);
    const between12 = fretPositionMm(13) - fretPositionMm(12);
    expect(between1).toBeGreaterThan(between12);
  });
});

describe("voicingWidthMm", () => {
  it("returns 0 when fretted notes < 2", () => {
    const voicing: Voicing = {
      positionKeys: ["0-3"],
      notes: [{ stringIndex: 0, fretIndex: 3, noteName: "G", midi: 67 }],
    };
    expect(voicingWidthMm(voicing)).toBe(0);
  });

  it("returns the physical width between the lowest and highest fretted note", () => {
    const voicing: Voicing = {
      positionKeys: ["0-3", "1-3", "2-5"],
      notes: [
        { stringIndex: 0, fretIndex: 3, noteName: "G", midi: 67 },
        { stringIndex: 1, fretIndex: 3, noteName: "D", midi: 62 },
        { stringIndex: 2, fretIndex: 5, noteName: "C", midi: 60 },
      ],
    };
    // Span = frets 3 → 5. Width = fretPos(5) − fretPos(2).
    const expected = fretPositionMm(5) - fretPositionMm(2);
    expect(voicingWidthMm(voicing)).toBeCloseTo(expected, 2);
  });
});

describe("filterByHandSpan", () => {
  const wideVoicing: Voicing = {
    positionKeys: ["0-1", "1-1", "2-8"],
    notes: [
      { stringIndex: 0, fretIndex: 1, noteName: "F", midi: 65 },
      { stringIndex: 1, fretIndex: 1, noteName: "C", midi: 60 },
      { stringIndex: 2, fretIndex: 8, noteName: "Eb", midi: 63 },
    ],
  };
  const tightVoicing: Voicing = {
    positionKeys: ["0-12", "1-13", "2-12"],
    notes: [
      { stringIndex: 0, fretIndex: 12, noteName: "E", midi: 64 },
      { stringIndex: 1, fretIndex: 13, noteName: "C", midi: 60 },
      { stringIndex: 2, fretIndex: 12, noteName: "G", midi: 67 },
    ],
  };

  it("filters out voicings exceeding the small threshold", () => {
    const out = filterByHandSpan([wideVoicing, tightVoicing], "small");
    expect(out).toContain(tightVoicing);
    expect(out).not.toContain(wideVoicing);
  });

  it("large threshold accepts more candidates than small", () => {
    const small = filterByHandSpan([wideVoicing, tightVoicing], "small");
    const large = filterByHandSpan([wideVoicing, tightVoicing], "large");
    expect(large.length).toBeGreaterThanOrEqual(small.length);
  });

  it("threshold table has all three sizes", () => {
    const sizes: HandSize[] = ["small", "medium", "large"];
    for (const s of sizes) {
      expect(HAND_SPAN_THRESHOLDS_MM[s]).toBeGreaterThan(0);
    }
  });
});
