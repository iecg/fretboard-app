import { describe, it, expect } from "vitest";
import {
  buildPolygonFromNotes,
  isShapeTruncated,
  wrapOvershootNotes,
  deduplicateAdjacentStrings,
  MAX_WRAP_OVERSHOOT,
} from "../shapes/polygons";
import { getFretboardNotes } from "../guitar";
import { STANDARD_TUNING } from "../guitar";

// ---------------------------------------------------------------------------
// buildPolygonFromNotes
// ---------------------------------------------------------------------------

describe("buildPolygonFromNotes", () => {
  it("returns empty array when all strings have no notes (empty shape)", () => {
    const perStringNotes: number[][] = [[], [], [], [], [], []];
    const result = buildPolygonFromNotes(perStringNotes, 6, new Set());
    expect(result).toEqual([]);
  });

  it("returns 12 vertices when all 6 strings share a single fret (single-fret span)", () => {
    const perStringNotes: number[][] = [[5], [5], [5], [5], [5], [5]];
    const result = buildPolygonFromNotes(perStringNotes, 6, new Set());
    // 6 left-edge + 6 right-edge = 12 vertices
    expect(result).toHaveLength(12);
    // Every vertex must be at fret 5
    for (const v of result) {
      expect(v.fret).toBe(5);
    }
  });

  it("returns empty array when all notes on every string are wrapped (wrapped-only string skipped)", () => {
    // Single string with two notes, both marked as wrapped
    const perStringNotes: number[][] = [[5, 6]];
    const wrappedNotes = new Set(["0-5", "0-6"]);
    const result = buildPolygonFromNotes(perStringNotes, 1, wrappedNotes);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isShapeTruncated
// ---------------------------------------------------------------------------

describe("isShapeTruncated", () => {
  it("returns true when visible span equals exactly 50% of intended span (boundary)", () => {
    // intendedSpan=4, visibleSpan=2 → visibleSpan <= intendedSpan/2 → true
    const result = isShapeTruncated(
      /* intendedMin */ -2,
      /* intendedMax */  2,
      /* shapeMin    */  0,
      /* shapeMax    */  2,
    );
    expect(result).toBe(true);
  });

  it("returns false when visible span is just above 50% of intended span", () => {
    // intendedSpan=4, visibleSpan=3 → 3 > 4/2=2 → false
    const result = isShapeTruncated(
      /* intendedMin */ -1,
      /* intendedMax */  3,
      /* shapeMin    */  0,
      /* shapeMax    */  3,
    );
    expect(result).toBe(false);
  });

  it("returns false when intended span is zero (zero-span guard)", () => {
    // intendedSpan=0 → condition intendedSpan > 0 is false → false
    const result = isShapeTruncated(
      /* intendedMin */ 5,
      /* intendedMax */ 5,
      /* shapeMin    */ 5,
      /* shapeMax    */ 5,
    );
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// wrapOvershootNotes
// ---------------------------------------------------------------------------

describe("wrapOvershootNotes", () => {
  // Build a real fretboard layout for standard tuning so the helper can look
  // up note names at arbitrary fret positions.
  const layout = getFretboardNotes(STANDARD_TUNING, 24);
  const numStrings = STANDARD_TUNING.length; // 6

  it("returns empty wrappedNotes when there is no overshoot", () => {
    // intendedMin/Max fully inside [0..frets] → neither gate triggers
    const perStringNotes: number[][] = Array.from({ length: numStrings }, () => [5]);
    const { wrappedNotes } = wrapOvershootNotes(
      perStringNotes,
      layout,
      /* validNotes  */ ["C", "D", "E", "F", "G", "A", "B"],
      /* intendedMin */ 5,
      /* intendedMax */ 9,
      /* shapeMin    */ 5,
      /* shapeMax    */ 9,
      /* frets       */ 24,
    );
    expect(wrappedNotes.size).toBe(0);
  });

  it("populates wrappedNotes when positive overshoot equals MAX_WRAP_OVERSHOOT (gate open)", () => {
    // intendedMax = frets + MAX_WRAP_OVERSHOOT → gate condition: intendedMax - frets <= MAX_WRAP_OVERSHOOT
    const frets = 24;
    const intendedMax = frets + MAX_WRAP_OVERSHOOT; // exactly at the limit
    // Give every string at least one note in the core shape so the helper has
    // something to wrap from.
    const perStringNotes: number[][] = Array.from(
      { length: numStrings },
      () => [22],
    );
    // Use all 12 chromatic note names as validNotes so any looked-up note matches
    const validNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const { wrappedNotes } = wrapOvershootNotes(
      perStringNotes,
      layout,
      validNotes,
      /* intendedMin */ 22,
      /* intendedMax */ intendedMax,
      /* shapeMin    */ 22,
      /* shapeMax    */ 24,
      frets,
    );
    // The gate must be open — at least one note should wrap (positive overshoot of 2 frets)
    expect(wrappedNotes.size).toBeGreaterThan(0);
  });

  it("returns empty wrappedNotes when positive overshoot exceeds MAX_WRAP_OVERSHOOT (gate closed)", () => {
    // intendedMax - frets = MAX_WRAP_OVERSHOOT + 1 → gate skipped entirely
    const frets = 24;
    const intendedMax = frets + MAX_WRAP_OVERSHOOT + 1; // one beyond the limit
    const perStringNotes: number[][] = Array.from(
      { length: numStrings },
      () => [22],
    );
    const validNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const { wrappedNotes } = wrapOvershootNotes(
      perStringNotes,
      layout,
      validNotes,
      /* intendedMin */ 22,
      /* intendedMax */ intendedMax,
      /* shapeMin    */ 22,
      /* shapeMax    */ 24,
      frets,
    );
    // The gate is closed → no notes should be added to wrappedNotes
    expect(wrappedNotes.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deduplicateAdjacentStrings
// ---------------------------------------------------------------------------

describe("deduplicateAdjacentStrings", () => {
  // Provide a minimal two-string fretboard layout for testing.
  // String 0 (upper): C  C# D  D# E  F  F# G  G# A  A# B  C ...
  // String 1 (lower): G  G# A  A# B  C  F# G  G# A  A# B  C ...
  // We construct synthetic layouts that place a shared note at predictable frets.

  it("removes the note with the greater neighbor-distance when the same note appears on adjacent strings", () => {
    // Arrange: string 0 has note "A" at frets [3, 9], string 1 has "A" at fret [5].
    // For the "A" at index 0 of string 0 (fret 3): neighbors are [3, 9] → dist to right = 6.
    // For the "A" at index 0 of string 1 (fret 5): no neighbors → Infinity.
    // upperDist = 6 (to fret 9), lowerDist = Infinity → upperDist < lowerDist → upper is kept, lower removed.
    // But wait — let's make it the reverse: upper has one note, lower has one note,
    // upper note is closer to its (nonexistent) neighbor → Infinity vs Infinity → upper is removed.
    // Use a cleaner setup: upper string has [4, 6] (two notes, dist to each = 2), lower has [5] alone (Infinity).
    // upperDist for index 0 of [4,6] = min(Infinity, 2) = 2; lowerDist = Infinity → upper stays (2 < Inf), lower removed.
    const layout: string[][] = [
      // string 0: 0=C, 1=C#, 2=D, 3=D#, 4=A, 5=F, 6=A, ...
      ["C", "C#", "D", "D#", "A", "F", "A", "G", "G#", "B", "A#", "B", "C"],
      // string 1: 0=G, 1=G#, 2=D, 3=D#, 4=E, 5=A, 6=F#, ...
      ["G", "G#", "D", "D#", "E", "A", "F#", "G", "G#", "B", "A#", "B", "C"],
    ];
    const perStringNotes: number[][] = [
      [4, 6], // string 0: "A" at fret 4, "A" at fret 6
      [5],    // string 1: "A" at fret 5
    ];
    deduplicateAdjacentStrings(perStringNotes, layout, null);
    // Lower string note "A"@5 should be removed because upperDist(A@4) = min(Inf, 2)=2 < lowerDist(Inf)
    expect(perStringNotes[1]).not.toContain(5);
    // Upper string notes should remain
    expect(perStringNotes[0]).toContain(4);
  });

  it("does NOT remove blue notes from adjacent strings (blue-note exemption)", () => {
    // Both strings share "Bb" (A#) but it is designated as the blue note.
    // The dedup loop skips pairs where the lower note name === blueNoteName.
    const layout: string[][] = [
      ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
      ["G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E", "A#", "B"],
    ];
    const perStringNotes: number[][] = [
      [10], // string 0: "A#" at fret 10
      [3],  // string 1: "A#" at fret 3
    ];
    // "A#" is the blue note — should be exempt from deduplication
    deduplicateAdjacentStrings(perStringNotes, layout, "A#");
    // Both strings must retain their blue note
    expect(perStringNotes[0]).toContain(10);
    expect(perStringNotes[1]).toContain(3);
  });
});
