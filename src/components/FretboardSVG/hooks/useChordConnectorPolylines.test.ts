import { describe, it, expect } from "vitest";
import {
  buildChordConnectorPolylines,
  MAX_FRET_SPAN,
  CHORD_TONE_CLASSES,
} from "./useChordConnectorPolylines";
import type { NoteData } from "./useNoteData";

// Geometry stubs: identity-like helpers for predictable test assertions.
// fretCenterX returns fret * 10 so we can spot-check x values.
// stringYAt returns stringIndex * 20 so we can spot-check y values.
const fretCenterX = (fi: number) => fi * 10;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stringYAt = (si: number, _x: number) => si * 20;

/**
 * Build a minimal NoteData entry for testing.
 * Defaults noteClass to "chord-tone-in-scale" (an active chord-tone role).
 */
function makeNote(
  si: number,
  fi: number,
  noteClass: string = "chord-tone-in-scale",
): NoteData {
  return {
    stringIndex: si,
    fretIndex: fi,
    noteName: "C",
    noteClass,
    displayValue: "C",
    applyDimOpacity: false,
    applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
    isHidden: false,
    isTension: false,
    isGuideTone: false,
  };
}

describe("buildChordConnectorPolylines", () => {
  // -------------------------------------------------------------------------
  // Algorithm-independent edge cases (unchanged by MST refactor)
  // -------------------------------------------------------------------------

  it("returns [] for empty noteData", () => {
    const result = buildChordConnectorPolylines([], fretCenterX, stringYAt);
    expect(result).toEqual([]);
  });

  it("returns [] for a single matching position (no edge possible)", () => {
    const noteData = [makeNote(0, 5, "chord-root")];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toEqual([]);
  });

  it("returns [] when all noteData entries have non-chord-tone noteClass", () => {
    const noteData = [
      makeNote(0, 3, "note-active"),
      makeNote(1, 5, "scale-only"),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toEqual([]);
  });

  it("returns [] when chord-tone entries are all note-inactive (shape-filtered)", () => {
    const noteData = [
      makeNote(0, 3, "note-inactive"),
      makeNote(1, 5, "note-inactive"),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // MST geometry — n-1 edges
  // -------------------------------------------------------------------------

  it("MST: 2 positions produce exactly 1 edge (n-1 = 1)", () => {
    const noteData = [makeNote(0, 2), makeNote(1, 4)];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it("MST: 3 positions produce exactly 2 edges (n-1 = 2)", () => {
    // Triangle: si0/fi5, si1/fi3, si2/fi5 — all within MAX_FRET_SPAN.
    const noteData = [
      makeNote(0, 5),
      makeNote(1, 3),
      makeNote(2, 5),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toHaveLength(2);
    result.forEach((edge) => expect(edge).toHaveLength(2));
  });

  it("MST: 4 positions produce exactly 3 edges (n-1 = 3)", () => {
    const noteData = [
      makeNote(0, 3),
      makeNote(1, 5),
      makeNote(2, 3),
      makeNote(3, 5),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toHaveLength(3);
    result.forEach((edge) => expect(edge).toHaveLength(2));
  });

  // -------------------------------------------------------------------------
  // MST selects geometrically shorter edges (not string-index order)
  // -------------------------------------------------------------------------

  it("MST selects the geometrically shorter edge over string-index order", () => {
    // Layout:
    //   A = si0, fi10  → x=100, y=0
    //   B = si1, fi10  → x=100, y=20   (closest to A: dist=20)
    //   C = si5, fi10  → x=100, y=100  (far from A: dist=100, dist from B: 80)
    //
    // String-index-order walk would produce: A→B→C (consecutive string pairs).
    // MST must also produce A-B and B-C (the 2 shortest edges of the linear chain).
    // Key check: no edge connecting A directly to C (which would be the longest edge).
    const noteData = [
      makeNote(0, 10),
      makeNote(1, 10),
      makeNote(5, 10),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toHaveLength(2);

    // Every returned vertex should share x=100 (fret 10 * 10).
    // There should be NO edge between y=0 (si0) and y=100 (si5) directly;
    // that would be the longer edge the MST should not include.
    const yValues = result.flatMap((edge) => edge.map((v) => v.y)).sort((a, b) => a - b);
    // si0→y=0, si1→y=20, si5→y=100. The 2 edges are [0,20] and [20,100].
    expect(yValues).toEqual([0, 20, 20, 100]);
  });

  it("MST on a triangle picks the 2 shortest edges, not the string-index pair", () => {
    // Triangle where si0/fi5, si1/fi3, si2/fi5:
    //   A = si0,fi5 → x=50, y=0
    //   B = si1,fi3 → x=30, y=20
    //   C = si2,fi5 → x=50, y=40
    //
    // Distances:
    //   A-B = sqrt((50-30)² + (0-20)²) = sqrt(400+400) ≈ 28.3
    //   B-C = sqrt((30-50)² + (20-40)²) = sqrt(400+400) ≈ 28.3
    //   A-C = sqrt((50-50)² + (0-40)²) = 40
    //
    // MST picks A-B and B-C (the two shorter edges, total ≈ 56.6).
    // It does NOT include A-C (longest, total with one of the others > MST cost).
    const noteData = [
      makeNote(0, 5),
      makeNote(1, 3),
      makeNote(2, 5),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toHaveLength(2);

    // Verify A-C edge (x=50,y=0) ↔ (x=50,y=40) is NOT present as a direct edge.
    const hasLongEdge = result.some(
      (edge) =>
        edge.some((v) => v.x === 50 && v.y === 0) &&
        edge.some((v) => v.x === 50 && v.y === 40),
    );
    expect(hasLongEdge).toBe(false);
  });

  // -------------------------------------------------------------------------
  // MAX_FRET_SPAN post-prune behavior
  // -------------------------------------------------------------------------

  it(`MST edge at exactly MAX_FRET_SPAN (${MAX_FRET_SPAN}) frets is NOT pruned`, () => {
    const noteData = [
      makeNote(0, 2),
      makeNote(1, 2 + MAX_FRET_SPAN), // distance = 5 = MAX_FRET_SPAN → kept
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it(`MST edge at MAX_FRET_SPAN + 1 (${MAX_FRET_SPAN + 1}) frets IS pruned`, () => {
    const noteData = [
      makeNote(0, 2),
      makeNote(1, 2 + MAX_FRET_SPAN + 1), // distance = 6 > MAX_FRET_SPAN → pruned
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toHaveLength(0);
  });

  it("multi-group: two clusters separated by > MAX_FRET_SPAN produce only intra-cluster edges", () => {
    // Group 1: frets 1–3; Group 2: frets 10–12 (gap = 7 > MAX_FRET_SPAN).
    // MST would want to connect them, but the cross-group edge is pruned.
    // Each group has 2 nodes → 1 intra-cluster edge each → 2 total edges.
    const noteData = [
      makeNote(0, 1),
      makeNote(1, 3),
      makeNote(2, 10),
      makeNote(3, 12),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    // Both intra-cluster edges survive pruning; cross-cluster MST edge is pruned.
    expect(result).toHaveLength(2);
    result.forEach((edge) => expect(edge).toHaveLength(2));
  });

  it("isolated far note: MST connects it but prune removes the long edge", () => {
    // C@fi2, E@fi3 form a close pair; G@fi12 connects to the pair via MST
    // but the MST edge to G has fret distance ≥ 9 > MAX_FRET_SPAN → pruned.
    // Close-pair edge (fret distance 1) survives.
    const noteData = [
      makeNote(0, 2),
      makeNote(1, 3),
      makeNote(2, 12),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    // Close pair: 1 edge. Far note: MST edge pruned.
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Shape-filter respect (Bug 3)
  // -------------------------------------------------------------------------

  it("respects active shape filter: note-inactive chord tones are excluded from MST", () => {
    // 4 chord-tone positions; 1 is note-inactive (outside active CAGED shape).
    // The MST should connect only the 3 active positions → 2 edges.
    const noteData = [
      makeNote(0, 3, "chord-root"),
      makeNote(1, 5, "chord-tone-in-scale"),
      makeNote(2, 3, "chord-tone-in-scale"),
      makeNote(3, 5, "note-inactive"), // outside shape → excluded
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    // 3 active nodes → n-1 = 2 MST edges (assuming all within MAX_FRET_SPAN).
    expect(result).toHaveLength(2);
    // Verify none of the edges include y = si3 * 20 = 60.
    const allYs = result.flatMap((edge) => edge.map((v) => v.y));
    expect(allYs).not.toContain(stringYAt(3, fretCenterX(5)));
  });

  it("fingeringPattern='all': all chord-tone positions included (none filtered)", () => {
    // When no shape filter is active, all chord-tone noteClass entries are included.
    // 4 active chord-tone positions → 3 MST edges.
    const noteData = [
      makeNote(0, 3, "chord-root"),
      makeNote(1, 5, "chord-tone-in-scale"),
      makeNote(2, 3, "chord-tone-in-scale"),
      makeNote(3, 5, "note-diatonic-chord"),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    expect(result).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // CHORD_TONE_CLASSES set covers the expected roles
  // -------------------------------------------------------------------------

  it("CHORD_TONE_CLASSES includes all expected chord-tone roles", () => {
    expect(CHORD_TONE_CLASSES.has("note-blue")).toBe(true);
    expect(CHORD_TONE_CLASSES.has("chord-tone-outside-scale")).toBe(true);
    expect(CHORD_TONE_CLASSES.has("chord-tone-in-scale")).toBe(true);
    expect(CHORD_TONE_CLASSES.has("note-diatonic-chord")).toBe(true);
    expect(CHORD_TONE_CLASSES.has("chord-root")).toBe(true);
    expect(CHORD_TONE_CLASSES.has("key-tonic")).toBe(true);
    // Non-chord roles must NOT be included.
    expect(CHORD_TONE_CLASSES.has("note-inactive")).toBe(false);
    expect(CHORD_TONE_CLASSES.has("note-active")).toBe(false);
    expect(CHORD_TONE_CLASSES.has("scale-only")).toBe(false);
  });

  it("non-chord-tone roles mixed with chord-tones are ignored", () => {
    // Only the 2 chord-tone notes should be connected; note-active is ignored.
    const noteData = [
      makeNote(0, 2, "chord-root"),
      makeNote(1, 4, "note-active"),
      makeNote(2, 6, "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, fretCenterX, stringYAt);
    // 2 chord-tone nodes → 1 MST edge.
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });
});
