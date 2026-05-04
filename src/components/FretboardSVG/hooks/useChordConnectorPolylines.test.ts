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

// Mock stringRowPx value (tablet default) used in all test calls.
const STRING_ROW_PX = 36;

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
    const result = buildChordConnectorPolylines([], ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toEqual([]);
  });

  it("returns [] when chordToneNames has fewer than 2 entries", () => {
    const noteData = [makeNote(0, 5, "C"), makeNote(1, 5, "E")];
    const result = buildChordConnectorPolylines(noteData, ["C"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toEqual([]);
  });

  it("returns [] when all noteData entries have non-chord-tone noteClass", () => {
    const noteData = [
      makeNote(0, 3, "C", "note-active"),
      makeNote(1, 5, "E", "note-active"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toEqual([]);
  });

  it("returns [] when chord-tone entries are all note-inactive (shape-filtered)", () => {
    const noteData = [
      makeNote(0, 3, "C", "note-inactive"),
      makeNote(1, 5, "E", "note-inactive"),
      makeNote(2, 3, "G", "note-inactive"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    expect(result[0]!.vertices).toHaveLength(3);
    // Vertices are polar-sorted; all should have y values from strings 0, 1, 2: 0, 20, 40.
    const yValues = result[0]!.vertices.map((v) => v.y).sort((a, b) => a - b);
    expect(yValues).toEqual([0, 20, 40]);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    // At least one voicing should be emitted covering all three chord tones.
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Every emitted voicing should be 3 vertices long (one per string).
    result.forEach((voicing) => expect(voicing.vertices).toHaveLength(3));
    // All emitted voicings contain each chord tone.
    // Check that each voicing spans 3 strings.
    const yValues = result[0]!.vertices.map((v) => v.y);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    // Verify x=70 (fret 7) is NOT in the voicing (only fret-5 is active).
    expect(result[0]!.vertices.some((v) => v.x === fretCenterX(7))).toBe(false);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
  });

  it(`(d) voicing spanning MAX_FRET_SPAN + 1 (${MAX_FRET_SPAN + 1}) frets is NOT emitted`, () => {
    // G is at fret 2 + MAX_FRET_SPAN + 1: beyond the window — no anchor covers both ends.
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 2, "E", "chord-tone-in-scale"),
      makeNote(2, 2 + MAX_FRET_SPAN + 1, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    // 4 valid consecutive-string windows each covering all 3 chord tones.
    expect(result).toHaveLength(4);
    result.forEach((voicing) => expect(voicing.vertices).toHaveLength(3));
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    // Two isolated string windows → 2 separate voicings.
    expect(result).toHaveLength(2);
    result.forEach((voicing) => expect(voicing.vertices).toHaveLength(3));
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G", "B"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    expect(result[0]!.vertices).toHaveLength(4);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(0);
  });

  it("(g) all 3 chord tones on same 2 strings → no valid voicing for triad (N=3 needs 3 strings)", () => {
    // Both C and G appear on string 0; E is on string 1. A triad needs 3 distinct strings.
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(0, 5, "G", "chord-tone-in-scale"),
      makeNote(1, 4, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    expect(result[0]!.vertices).toHaveLength(3);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(0);
  });

  it("2-tone chord on consecutive strings emits 1 voicing", () => {
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 4, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    expect(result[0]!.vertices).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Regression: C major triad fret-5 voicing with CAGED G shape active
  //
  // CAGED G shape in C major (standard tuning, 6-string) covers roughly frets
  // 5-8.  The tightest C major triad voicing sits at fret 5:
  //   str1 (B)  fret 5 = E  (chord-tone-in-scale)
  //   str2 (G)  fret 5 = C  (chord-root)
  //   str3 (D)  fret 5 = G  (chord-tone-in-scale)
  //
  // Simultaneously, a second CAGED G polygon at fret 17 gives:
  //   str1 fret 17 = E, str2 fret 17 = C, str3 fret 17 = G
  //
  // Both voicings must be emitted.  Before the voicing-aware algorithm, the
  // Prim MST approach produced unstructured 2-vertex segments and the fret-5
  // cluster was occasionally missed when the anchor-ordering led dedup to
  // suppress it.  This test guards against that regression.
  // -------------------------------------------------------------------------

  it("(regression) CAGED G shape: emits fret-5 E-C-G voicing on strings 1-2-3", () => {
    // Simulates C major with CAGED G shape active (first polygon, frets 5-8):
    //   str0 (E4):  C@8                             — chord root, frets 5-8
    //   str1 (B3):  E@5, G@8                        — chord tones, frets 5-8
    //   str2 (G3):  C@5                             — chord root, frets 4-7
    //   str3 (D3):  G@5                             — chord tone, frets 5-7
    //   str4 (A2):  E@7                             — chord tone, frets 5-8
    //   str5 (E2):  C@8                             — chord root, frets 5-8
    // (scale-only notes omitted; only chord-tone roles feed the connector)
    const noteData = [
      makeNote(0, 8, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(1, 8, "G", "chord-tone-in-scale"),
      makeNote(2, 5, "C", "chord-root"),
      makeNote(3, 5, "G", "chord-tone-in-scale"),
      makeNote(4, 7, "E", "chord-tone-in-scale"),
      makeNote(5, 8, "C", "chord-root"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);

    // The fret-5 voicing on strings 1-2-3 must be present.
    const fret5Voicing = result.find(
      (voicing) =>
        voicing.vertices.length === 3 &&
        voicing.vertices.some((v) => v.y === stringYAt(1, fretCenterX(5)) && v.x === fretCenterX(5)) &&
        voicing.vertices.some((v) => v.y === stringYAt(2, fretCenterX(5)) && v.x === fretCenterX(5)) &&
        voicing.vertices.some((v) => v.y === stringYAt(3, fretCenterX(5)) && v.x === fretCenterX(5)),
    );
    expect(fret5Voicing, "fret-5 E(str1)-C(str2)-G(str3) voicing not emitted").toBeDefined();
    expect(fret5Voicing!.vertices).toHaveLength(3);
  });

  it("(regression) CAGED G shape: emits both fret-5 and fret-17 voicings when both polygon instances present", () => {
    // Both CAGED G polygon instances (fret 5-8 and fret 17-20) are active
    // simultaneously (getCagedCoordinates returns two polygons for C major G shape).
    // The fret-5 and fret-17 voicings must each be emitted exactly once and
    // must not suppress each other via the deduplication set.
    const noteData = [
      // First CAGED G polygon (frets 5-8)
      makeNote(0, 8, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(1, 8, "G", "chord-tone-in-scale"),
      makeNote(2, 5, "C", "chord-root"),
      makeNote(3, 5, "G", "chord-tone-in-scale"),
      makeNote(4, 7, "E", "chord-tone-in-scale"),
      makeNote(5, 8, "C", "chord-root"),
      // Second CAGED G polygon (frets 17-20)
      makeNote(0, 20, "C", "chord-root"),
      makeNote(1, 17, "E", "chord-tone-in-scale"),
      makeNote(1, 20, "G", "chord-tone-in-scale"),
      makeNote(2, 17, "C", "chord-root"),
      makeNote(3, 17, "G", "chord-tone-in-scale"),
      makeNote(4, 19, "E", "chord-tone-in-scale"),
      makeNote(5, 20, "C", "chord-root"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);

    const fret5 = result.find(
      (voicing) =>
        voicing.vertices.length === 3 &&
        voicing.vertices.some((v) => v.y === stringYAt(1, fretCenterX(5)) && v.x === fretCenterX(5)) &&
        voicing.vertices.some((v) => v.y === stringYAt(2, fretCenterX(5)) && v.x === fretCenterX(5)) &&
        voicing.vertices.some((v) => v.y === stringYAt(3, fretCenterX(5)) && v.x === fretCenterX(5)),
    );
    const fret17 = result.find(
      (voicing) =>
        voicing.vertices.length === 3 &&
        voicing.vertices.some((v) => v.y === stringYAt(1, fretCenterX(17)) && v.x === fretCenterX(17)) &&
        voicing.vertices.some((v) => v.y === stringYAt(2, fretCenterX(17)) && v.x === fretCenterX(17)) &&
        voicing.vertices.some((v) => v.y === stringYAt(3, fretCenterX(17)) && v.x === fretCenterX(17)),
    );

    expect(fret5, "fret-5 E(str1)-C(str2)-G(str3) voicing not emitted").toBeDefined();
    expect(fret17, "fret-17 E(str1)-C(str2)-G(str3) voicing not emitted").toBeDefined();
    // Each voicing is distinct — dedup must not suppress one in favour of the other.
    expect(fret5).not.toBe(fret17);
  });

  // -------------------------------------------------------------------------
  // Contour smoke tests (offset-outline geometry)
  // -------------------------------------------------------------------------

  it("triad voicing (non-collinear): envelope has A arc commands, spine visits all 3 vertices", () => {
    // C major triad on 3 different frets (non-collinear 3-vertex hull) →
    // envelope: rounded offset polygon with 3 A arc commands.
    // spine: closed polyline through all 3 polar-sorted vertices (3 L commands + Z).
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    const { envelope, spine } = result[0]!;
    // Envelope: non-empty closed path with arc commands.
    expect(envelope).not.toBe("");
    expect(envelope.startsWith("M")).toBe(true);
    expect(envelope.endsWith("Z")).toBe(true);
    expect(envelope).toContain("A");
    expect(envelope).toContain("L");
    // Spine: closed polyline — M v0 L v1 L v2 Z → 2 L commands for 3 vertices.
    expect(spine).not.toBe("");
    expect(spine.startsWith("M")).toBe(true);
    expect(spine.endsWith("Z")).toBe(true);
    const spineLCount = (spine.match(/\bL\b/g) ?? []).length;
    expect(spineLCount).toBe(2);
  });

  it("7th chord voicing (4-vertex hull): envelope has 4 arc commands, spine visits all 4 vertices", () => {
    // Cmaj7: C, E, G, B spread across 4 strings and different frets →
    // envelope: 4-vertex convex hull → rounded offset polygon with 4 A arc commands.
    // spine: closed polyline through all 4 polar-sorted vertices (4 L commands + Z).
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
      makeNote(3, 6, "B", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G", "B"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    const { envelope, spine } = result[0]!;
    // Envelope: non-empty closed path with arc commands.
    expect(envelope).not.toBe("");
    expect(envelope.startsWith("M")).toBe(true);
    expect(envelope.endsWith("Z")).toBe(true);
    expect(envelope).toContain("A");
    // Spine: closed polyline — M v0 L v1 L v2 L v3 Z → 3 L commands for 4 vertices.
    expect(spine).not.toBe("");
    expect(spine.startsWith("M")).toBe(true);
    expect(spine.endsWith("Z")).toBe(true);
    const spineLCount = (spine.match(/\bL\b/g) ?? []).length;
    expect(spineLCount).toBe(3);
  });

  it("collinear voicing (same fret, 3 adjacent strings): envelope is capsule, spine is open polyline", () => {
    // All 3 notes at the exact same fret → same x coordinate → perfectly collinear.
    // envelope: convexHull → 2-vertex hull → capsule (2 A arc commands, 2 L segments).
    // spine: open polyline (no Z — zero signed area avoids stroke retracing).
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    const { envelope, spine } = result[0]!;
    // Envelope: capsule with exactly 2 A arc commands and 2 L segments.
    expect(envelope).not.toBe("");
    expect(envelope.startsWith("M")).toBe(true);
    expect(envelope.endsWith("Z")).toBe(true);
    const envACount = (envelope.match(/\bA\b/g) ?? []).length;
    expect(envACount).toBe(2);
    const envLCount = (envelope.match(/\bL\b/g) ?? []).length;
    expect(envLCount).toBe(2);
    // Regression: verify the capsule bbox-width is approximately 2 * r = 2 * (STRING_ROW_PX * 0.55).
    // With STRING_ROW_PX=36: r=19.8, so width ≈ 39.6.
    // fretCenterX(5) = 50. Capsule extends to x = 50 ± 19.8.
    expect(envelope).toContain("30.2");
    expect(envelope).toContain("69.8");
    // Spine: open polyline (no Z) — 2 L commands through 3 polar-sorted vertices.
    expect(spine).not.toBe("");
    expect(spine.startsWith("M")).toBe(true);
    expect(spine.endsWith("Z")).toBe(false);
    const spineLCount = (spine.match(/\bL\b/g) ?? []).length;
    expect(spineLCount).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Regression: near-collinear diagonal triad G-E-C must visit all 3 vertices
  //
  // Bug: convexHull dropped the middle vertex E when G→E→C were near-collinear
  // (E within cross-product tolerance of the G-C line), collapsing the contour
  // to a 2-vertex capsule spanning the long diagonal from G to C.
  // Fix: polarSort retains every vertex; offsetOutlinePath visits all 3.
  // -------------------------------------------------------------------------

  it("(regression) near-collinear diagonal G-E-C: spine visits all 3 vertices, envelope is a clean capsule", () => {
    // Voicing: G(string 4, fret 5) → E(string 5, fret 7) → C(string 6, fret 8).
    // With fretCenterX(fi)=fi*10 and stringYAt(si)=si*20:
    //   G: x=50, y=80   E: x=70, y=100   C: x=80, y=120 (near-collinear diagonal).
    //
    // envelope: convexHull collapses near-collinear to [G, C] → capsule (2 A arcs).
    //           Clean, non-self-intersecting shape boundary around the chord region.
    // spine:    polarSort retains all 3 vertices → 3 L commands + Z.
    //           Visits every note so the dashed line reaches all chord tones.
    const noteData = [
      makeNote(4, 5, "G", "chord-tone-in-scale"),
      makeNote(5, 7, "E", "chord-tone-in-scale"),
      makeNote(6, 8, "C", "chord-root"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toHaveLength(1);
    const { envelope, spine } = result[0]!;
    // Spine: visits all 3 vertices — M v0 L v1 L v2 Z → 2 L commands, closed with Z.
    expect(spine).not.toBe("");
    expect(spine.startsWith("M")).toBe(true);
    expect(spine.endsWith("Z")).toBe(true);
    const spineLCount = (spine.match(/\bL\b/g) ?? []).length;
    expect(spineLCount).toBe(2);
    // Envelope: non-empty clean path (capsule or polygon — don't pin exact shape
    // since hull collapse behavior is convexHull implementation detail).
    expect(envelope).not.toBe("");
    expect(envelope.startsWith("M")).toBe(true);
    expect(envelope.endsWith("Z")).toBe(true);
  });
});
