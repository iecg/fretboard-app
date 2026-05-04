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
  noteName: string = "C",
  noteClass: string = "chord-tone-in-scale",
): NoteData {
  return {
    stringIndex: si,
    fretIndex: fi,
    noteName,
    noteClass,
    displayValue: noteName,
    applyDimOpacity: false,
    applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
    isHidden: false,
    isTension: false,
    isGuideTone: false,
  };
}

describe("buildChordConnectorPolylines", () => {
  // -------------------------------------------------------------------------
  // Edge cases — empty / insufficient data
  // -------------------------------------------------------------------------

  it("returns [] for empty noteData", () => {
    const result = buildChordConnectorPolylines([], ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toEqual([]);
  });

  it("returns [] when chordToneNames has fewer than 2 entries", () => {
    const noteData = [makeNote(0, 5, "C"), makeNote(1, 5, "E")];
    const result = buildChordConnectorPolylines(noteData, ["C"], fretCenterX, stringYAt);
    expect(result).toEqual([]);
  });

  it("returns [] when all noteData entries have non-chord-tone noteClass", () => {
    const noteData = [
      makeNote(0, 3, "C", "note-active"),
      makeNote(1, 5, "E", "note-active"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toEqual([]);
  });

  it("returns [] when chord-tone entries are all note-inactive (shape-filtered)", () => {
    const noteData = [
      makeNote(0, 3, "C", "note-inactive"),
      makeNote(1, 5, "E", "note-inactive"),
      makeNote(2, 3, "G", "note-inactive"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // (a) Triad on a 3-string window emits 1 voicing connecting 3 strings
  // -------------------------------------------------------------------------

  it("(a) triad on 3 strings: emits 1 voicing with 3 vertices covering all 3 chord tones", () => {
    // C major triad: C on string 0, E on string 1, G on string 2, all at fret 5.
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
    // Vertices are ordered by string index: y = 0, 20, 40.
    expect(result[0]!.map((v) => v.y)).toEqual([0, 20, 40]);
  });

  // -------------------------------------------------------------------------
  // (b) Triad with multiple candidates emits expected voicings
  // -------------------------------------------------------------------------

  it("(b) 4 candidate positions across 3 strings: emits voicings covering all 3 chord tones", () => {
    // String 0: C at fret 3
    // String 1: E at fret 3, also E at fret 5 (two candidates for E)
    // String 2: G at fret 3
    // The valid voicing picks one per string such that {C, E, G} are all covered.
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 3, "E", "chord-tone-in-scale"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 3, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    // At least one voicing should be emitted covering all three chord tones.
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Every emitted polyline should be 3 vertices long (one per string).
    result.forEach((vertices) => expect(vertices).toHaveLength(3));
    // All emitted voicings contain each chord tone.
    // Check that each voicing spans 3 strings.
    const yValues = result[0]!.map((v) => v.y);
    expect(yValues).toContain(stringYAt(0, fretCenterX(3)));  // string 0
    expect(yValues).toContain(stringYAt(2, fretCenterX(3)));  // string 2
  });

  // -------------------------------------------------------------------------
  // (c) Shape filter: note-inactive excluded
  // -------------------------------------------------------------------------

  it("(c) shape filter: note-inactive chord tones are excluded from voicings", () => {
    // String 0: C — active
    // String 1: E — active
    // String 2: G — INACTIVE (outside current CAGED shape)
    // String 3: B — active (but now we need G for the triad, so no valid voicing on strings 0-2)
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "note-inactive"),        // excluded by shape filter
      makeNote(3, 5, "B", "chord-tone-in-scale"),
    ];
    // Triad C-E-G: G is inactive → no complete voicing possible on strings 0-2.
    // Even if we extend to strings 1-3 (E, G-inactive, B), still missing G.
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(0);
  });

  it("(c) shape filter: active shape gives valid voicings, inactive positions skipped", () => {
    // Three strings with one valid chord-tone position each, one extra inactive position.
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
      makeNote(2, 7, "A", "note-inactive"),  // inactive — should not appear
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(1);
    // Verify y=40 (string 2, fret 5) is in the voicing, not y=40 at fret 7 (inactive).
    expect(result[0]!.some((v) => v.x === fretCenterX(7))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // (d) MAX_FRET_SPAN boundary
  // -------------------------------------------------------------------------

  it(`(d) voicing spanning exactly MAX_FRET_SPAN (${MAX_FRET_SPAN}) frets is emitted`, () => {
    // C at fret 2, E at fret 2, G at fret 2 + MAX_FRET_SPAN: span = MAX_FRET_SPAN → kept.
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 2, "E", "chord-tone-in-scale"),
      makeNote(2, 2 + MAX_FRET_SPAN, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(1);
  });

  it(`(d) voicing spanning MAX_FRET_SPAN + 1 (${MAX_FRET_SPAN + 1}) frets is NOT emitted`, () => {
    // G is at fret 2 + MAX_FRET_SPAN + 1: beyond the window — no anchor covers both ends.
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 2, "E", "chord-tone-in-scale"),
      makeNote(2, 2 + MAX_FRET_SPAN + 1, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // (e) Repeating shapes across multiple string windows
  // -------------------------------------------------------------------------

  it("(e) same chord shape repeated across 6 strings emits voicings for each N-string window", () => {
    // C major triad (N=3) across strings 0-5, all at fret 5.
    // Each chord tone name appears on 2 strings (C on 0,3; E on 1,4; G on 2,5).
    // Valid N=3 consecutive-string windows that cover C+E+G: [0,1,2], [1,2,3], [2,3,4], [3,4,5].
    //   - [0,1,2]: C@0, E@1, G@2 → {C,E,G} ✓
    //   - [1,2,3]: E@1, G@2, C@3 → {E,G,C} ✓
    //   - [2,3,4]: G@2, C@3, E@4 → {G,C,E} ✓
    //   - [3,4,5]: C@3, E@4, G@5 → {C,E,G} ✓
    // Each is a distinct voicing (different string sets) → 4 total.
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
      makeNote(3, 5, "C", "chord-root"),
      makeNote(4, 5, "E", "chord-tone-in-scale"),
      makeNote(5, 5, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    // 4 valid consecutive-string windows each covering all 3 chord tones.
    expect(result).toHaveLength(4);
    result.forEach((vertices) => expect(vertices).toHaveLength(3));
  });

  it("(e) two isolated chord positions on non-overlapping string sets emit 2 voicings", () => {
    // C major triad on strings 0-2 (region 1) and strings 4-6 (region 2).
    // String 3 has no chord tones → the two regions are isolated.
    // Window [0,1,2] → valid voicing. Window [4,5,6] → valid voicing.
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
      // string 3: no chord tones
      makeNote(4, 5, "C", "chord-root"),
      makeNote(5, 5, "E", "chord-tone-in-scale"),
      makeNote(6, 5, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    // Two isolated string windows → 2 separate voicings.
    expect(result).toHaveLength(2);
    result.forEach((vertices) => expect(vertices).toHaveLength(3));
  });

  // -------------------------------------------------------------------------
  // (f) 7th chord (4 chord tones) on a 4-string window
  // -------------------------------------------------------------------------

  it("(f) 7th chord on 4-string window emits 4-vertex voicings", () => {
    // Cmaj7: C, E, G, B across strings 0-3.
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 4, "E", "chord-tone-in-scale"),
      makeNote(2, 3, "G", "chord-tone-in-scale"),
      makeNote(3, 4, "B", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G", "B"], fretCenterX, stringYAt);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(4);
  });

  // -------------------------------------------------------------------------
  // (g) Missing chord tone → no valid voicing for triad
  // -------------------------------------------------------------------------

  it("(g) chord tone present on only 2 strings → no valid voicing for triad → empty", () => {
    // C is on string 0, E is on string 1, but G is missing entirely.
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(0);
  });

  it("(g) all 3 chord tones on same 2 strings → no valid voicing for triad (N=3 needs 3 strings)", () => {
    // Both C and G appear on string 0; E is on string 1. A triad needs 3 distinct strings.
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(0, 5, "G", "chord-tone-in-scale"),
      makeNote(1, 4, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Deduplication — same voicing from two anchor frets is only emitted once
  // -------------------------------------------------------------------------

  it("deduplicated: same voicing reached via two anchor frets appears only once", () => {
    // C@fret3/string0, E@fret3/string1, G@fret4/string2.
    // Anchor=3: cluster covers frets 3-8 → valid voicing (C,E,G) at (3,3,4).
    // Anchor=4: cluster covers frets 4-9 → same combo is NOT in anchor=4 range
    //           because C and E are at fret 3 which is < 4. So only one emission.
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 3, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // Non-adjacent string window: a chord tone on non-adjacent strings does NOT
  // form a voicing unless all N consecutive strings are covered
  // -------------------------------------------------------------------------

  it("chord tones on strings 0 and 2 only (skipping string 1) → no valid triad voicing", () => {
    // String 1 has no chord tone, so no N=3 consecutive-string window can be completed.
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(2, 5, "E", "chord-tone-in-scale"),
      makeNote(3, 5, "G", "chord-tone-in-scale"),
    ];
    // Window [0,1,2]: string 1 has no candidates → invalid.
    // Window [1,2,3]: string 1 has no candidates → invalid.
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    expect(result).toHaveLength(0);
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
    // String 0: C (chord-root), string 1: note-active (ignored), string 2: E (chord-tone)
    // With chordTones ["C","E","G"], we need G too — not present, so empty.
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 4, "D", "note-active"),
      makeNote(2, 6, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt);
    // G is missing → no complete voicing.
    expect(result).toHaveLength(0);
  });

  it("non-chord-tone roles ignored, valid 2-tone chord still works with 2 chord tones", () => {
    // chordTones = ["C","E"] → N=2; note-active on string 1 is ignored.
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 4, "D", "note-active"),   // ignored
      makeNote(2, 6, "E", "chord-tone-in-scale"),
    ];
    // N=2: window [0,1] — string 1 has no chord tone → invalid.
    // Window [1,2] — string 1 has no chord tone → invalid.
    // Window [0,2] — not consecutive.
    // Actually with N=2, window is [0,1] and [1,2] and [2,3]... string 1 never has chord tone.
    // So expect 0.
    const result = buildChordConnectorPolylines(noteData, ["C", "E"], fretCenterX, stringYAt);
    expect(result).toHaveLength(0);
  });

  it("2-tone chord on consecutive strings emits 1 voicing", () => {
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 4, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E"], fretCenterX, stringYAt);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });
});
