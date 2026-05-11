import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  buildChordConnectorPolylines,
  MAX_PLAYABLE_FRET_POSITIONS,
  CHORD_TONE_CLASSES,
  clampConnectorRadiusToYBounds,
  CHORD_CONNECTOR_RADIUS_FACTORS,
  computeChordConnectorRadiusPx,
  resolveConnectorRadiusPx,
  useChordConnectorPolylines,
  INTERVAL_TO_PALETTE,
} from "./useChordConnectorPolylines";
import type { NoteData } from "./useNoteData";
import { chordRootVisualRadiusPx } from "../utils/noteSizing";

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
    octave: 4,
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
    const result = buildChordConnectorPolylines([], ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toEqual([]);
  });

  it("returns [] when chordToneNames has fewer than 2 entries", () => {
    const noteData = [makeNote(0, 5, "C"), makeNote(1, 5, "E")];
    const result = buildChordConnectorPolylines(noteData, ["C"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toEqual([]);
  });

  it("returns [] when all noteData entries have non-chord-tone noteClass", () => {
    const noteData = [
      makeNote(0, 3, "C", "note-active"),
      makeNote(1, 5, "E", "note-active"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toEqual([]);
  });

  it("returns [] when chord-tone entries are all note-inactive (shape-filtered)", () => {
    const noteData = [
      makeNote(0, 3, "C", "note-inactive"),
      makeNote(1, 5, "E", "note-inactive"),
      makeNote(2, 3, "G", "note-inactive"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toEqual([]);
  });

  it("documents shape-scoped CAGED behavior: different active chord-tone sets can produce different voicings", () => {
    const eShapeLikeNotes = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const gShapeLikeNotes = [
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "C", "chord-root"),
      makeNote(3, 5, "G", "chord-tone-in-scale"),
    ];

    const eShape = buildChordConnectorPolylines(
      eShapeLikeNotes,
      ["C", "E", "G"],
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
      "C",
    );
    const gShape = buildChordConnectorPolylines(
      gShapeLikeNotes,
      ["C", "E", "G"],
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
      "C",
    );

    expect(eShape.map((voicing) => voicing.voicingKey)).not.toEqual(
      gShape.map((voicing) => voicing.voicingKey),
    );
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
    // Verify x=70 (fret 7) is NOT in the voicing (only fret-5 is active).
    expect(result[0]!.vertices.some((v) => v.x === fretCenterX(7))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // (d) MAX_PLAYABLE_FRET_POSITIONS boundary (fret-positions-inclusive filter)
  // -------------------------------------------------------------------------

  it(`(d) voicing with exactly MAX_PLAYABLE_FRET_POSITIONS (${MAX_PLAYABLE_FRET_POSITIONS}) fret positions inclusive is emitted`, () => {
    // C at fret 2, E at fret 3, G at fret 4.
    // Fretted positions {2,3,4} → count = 3 = MAX_PLAYABLE_FRET_POSITIONS → kept.
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 3, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
  });

  it(`(d) voicing with MAX_PLAYABLE_FRET_POSITIONS + 1 (${MAX_PLAYABLE_FRET_POSITIONS + 1}) fret positions inclusive is NOT emitted`, () => {
    // Fretted notes at frets {2,3,4,5}: position count = 4 > MAX_PLAYABLE_FRET_POSITIONS → dropped.
    // Note: all notes must still be within MAX_FRET_SPAN of the anchor so the
    // candidate-gathering window can find them; the voicing is dropped only by
    // the playability filter, not the cluster window.
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 3, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(0);
  });

  it("(d) UAT-ISSUE-1: Cm7 voicing frets [5,6,8,8] (4 positions inclusive) is NOT emitted", () => {
    // Real-world UAT case: D#@str4-fret6, A#@str3-fret8, C@str2-fret5, G@str1-fret8
    // Fretted positions {5,6,7,8} → count = 4 > MAX_PLAYABLE_FRET_POSITIONS → dropped.
    const noteData = [
      makeNote(0, 8, "G", "chord-tone-in-scale"),  // G (str1 in guitar numbering)
      makeNote(1, 5, "C", "chord-root"),            // C (str2)
      makeNote(2, 8, "A#", "chord-tone-in-scale"),  // A# (str3)
      makeNote(3, 6, "D#", "chord-tone-in-scale"),  // D# (str4)
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "D#", "G", "A#"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(0);
  });

  it("(d) UAT-ISSUE-2: Cm7 voicing frets [4,5,5,6] (3 positions inclusive) is emitted", () => {
    // Real-world UAT case: A#@str0-fret6, D#@str1-fret4, C@str2-fret5, G@str3-fret5
    // Fretted positions {4,5,6} → count = 3 = MAX_PLAYABLE_FRET_POSITIONS → kept.
    const noteData = [
      makeNote(0, 6, "A#", "chord-tone-in-scale"),  // A# (str1 in guitar numbering)
      makeNote(1, 4, "D#", "chord-tone-in-scale"),  // D# (str2)
      makeNote(2, 5, "C", "chord-root"),             // C (str3)
      makeNote(3, 5, "G", "chord-tone-in-scale"),   // G (str4)
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "D#", "G", "A#"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // (d) Playability filter — open-string and single-fretted-note edge cases
  // -------------------------------------------------------------------------

  it("(d) voicing with all-open strings [0,0,0,0,0,0] → kept (fretted span undefined / no fretted notes)", () => {
    // Six open strings: no fretted note → fretted span = 0 → not filtered.
    // chordToneNames must match the open-string notes; use a 2-note chord to
    // satisfy N>=2 without needing 6 distinct tones.
    const noteData = [
      makeNote(0, 0, "C", "chord-root"),
      makeNote(1, 0, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
  });

  it("(d) voicing with one fretted note → kept (single fretted note, span 0)", () => {
    // Open C on string 0 (fret 0) + E on string 1 at fret 3. Only one fretted
    // note → frettedSpan = 0 → not filtered out. Both notes must fit within the
    // same cluster window (anchor=0 covers frets 0..MAX_FRET_SPAN=5).
    const noteData = [
      makeNote(0, 0, "C", "chord-root"),
      makeNote(1, 3, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
  });

  it("(d) voicing with open string + frets [2,3]: 2 fret positions inclusive → kept", () => {
    // Open C (excluded from span) + E@fret2 + G@fret3.
    // Fretted positions {2,3} → count = 2 ≤ MAX_PLAYABLE_FRET_POSITIONS → kept.
    const noteData = [
      makeNote(0, 0, "C", "chord-root"),
      makeNote(1, 2, "E", "chord-tone-in-scale"),
      makeNote(2, 3, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
  });

  it("(d) voicing with frets [1,5,5,5]: 5 fret positions inclusive → dropped", () => {
    // Fretted notes: {1,5} → positions {1,2,3,4,5} → count = 5 > MAX_PLAYABLE_FRET_POSITIONS → dropped.
    const noteData = [
      makeNote(0, 1, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G", "B"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(0);
  });

  it("(g) all 3 chord tones on same 2 strings → no valid voicing for triad (N=3 needs 3 strings)", () => {
    // Both C and G appear on string 0; E is on string 1. A triad needs 3 distinct strings.
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(0, 5, "G", "chord-tone-in-scale"),
      makeNote(1, 4, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(0);
  });

  it("2-tone chord on consecutive strings emits 1 voicing", () => {
    const noteData = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 4, "E", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");

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
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");

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
  // Contour smoke tests (fat polyline geometry)
  // -------------------------------------------------------------------------

  it("triad voicing (3 different frets): paths.fill is a rounded tube visiting all 3 vertices", () => {
    // C major triad on 3 different frets — non-collinear, so
    // offsetOpenPolylinePath emits a rounded tube tracing the voicing
    // order: a round arc on the outside of the bend at V_1, a mitered
    // intersection on the inside, plus a semicircular cap at each end.
    // fill === outline (byte-identical).
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
    const { paths } = result[0]!;
    expect(paths.fill).not.toBe("");
    expect(paths.fill.startsWith("M")).toBe(true);
    expect(paths.fill.endsWith("Z")).toBe(true);
    // Non-collinear triad → 1 outside corner arc + 2 end caps = 3 A commands.
    const aCount = (paths.fill.match(/\bA\b/g) ?? []).length;
    expect(aCount).toBe(3);
    // fill and outline are byte-identical for every voicing.
    expect(paths.fill).toBe(paths.outline);
  });

  it("7th chord voicing (4 vertices): paths.fill is a rounded tube visiting all 4 vertices", () => {
    // Cmaj7: C, E, G, B across 4 strings within 3 fret positions.
    // Frets [3,4,4,5]: positions {3,4,5} → count 3 ≤ MAX_PLAYABLE_FRET_POSITIONS → kept.
    // Non-collinear 4-vertex tube (fill === outline).
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 4, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
      makeNote(3, 5, "B", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G", "B"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
    const { paths } = result[0]!;
    expect(paths.fill).not.toBe("");
    expect(paths.fill.startsWith("M")).toBe(true);
    expect(paths.fill.endsWith("Z")).toBe(true);
    // 4 vertices with 2 interior corners → 2 outside corner arcs + 2 end caps.
    const aCount = (paths.fill.match(/\bA\b/g) ?? []).length;
    expect(aCount).toBe(4);
    // fill and outline are byte-identical.
    expect(paths.fill).toBe(paths.outline);
  });

  it("collinear voicing (same fret, 3 adjacent strings): paths are inflated capsule with arc commands", () => {
    // All 3 notes at the exact same fret → same x coordinate → collinear.
    // Collinear dispatch → inflatedCapsulePath → contains arc 'A' commands.
    // fretCenterX(5) = 50; all x values equal 50.
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
    const { paths } = result[0]!;
    expect(paths.fill).not.toBe("");
    // Capsule path contains arc commands.
    expect(paths.fill).toContain("A");
    expect(paths.outline).toContain("A");
    // fill and outline are byte-identical for collinear voicings too.
    expect(paths.fill).toBe(paths.outline);
  });

  // -------------------------------------------------------------------------
  // Regression: near-collinear diagonal triad G-E-C
  //
  // G(string 4, fret 5) → E(string 5, fret 6) → C(string 6, fret 7):
  // x=50,y=80; x=60,y=100; x=70,y=120 — exactly collinear (shoelace area = 0).
  // Dispatch → inflatedCapsulePath → capsule with arc 'A' commands.
  // The capsule envelops all 3 vertices without dropping any.
  // -------------------------------------------------------------------------

  it("(regression) near-collinear diagonal G-E-C: paths are capsule (all 3 vertices enveloped)", () => {
    // Voicing: G(string 4, fret 5) → E(string 5, fret 6) → C(string 6, fret 7).
    // Frets [5,6,7]: positions {5,6,7} → count 3 ≤ MAX_PLAYABLE_FRET_POSITIONS → kept.
    // With fretCenterX(fi)=fi*10 and stringYAt(si)=si*20:
    //   G: x=50, y=80   E: x=60, y=100   C: x=70, y=120 — exactly collinear.
    // Capsule path envelops all vertices; arc 'A' commands confirm capsule dispatch.
    const noteData = [
      makeNote(4, 5, "G", "chord-tone-in-scale"),
      makeNote(5, 6, "E", "chord-tone-in-scale"),
      makeNote(6, 7, "C", "chord-root"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
    const { paths } = result[0]!;
    expect(paths.fill).not.toBe("");
    // Collinear diagonal → capsule dispatch → arc commands present.
    expect(paths.fill).toContain("A");
    expect(paths.fill).toBe(paths.outline);
  });

  // -------------------------------------------------------------------------
  // New: non-collinear fill === outline (byte-identical)
  // -------------------------------------------------------------------------

  it("non-collinear voicing: fill and outline paths are byte-identical", () => {
    // Use 3 notes at different frets to guarantee non-collinear polygon.
    const noteData = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(
      noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.paths.fill).toBe(result[0]!.paths.outline);
    expect(result[0]!.paths.fill).toContain("Z"); // closed polygon
  });

  // -------------------------------------------------------------------------
  // New: collinear voicing capsule arcs
  // -------------------------------------------------------------------------

  it("collinear voicing: both fill and outline are inflated capsule paths", () => {
    // Use 3 notes at same fret to guarantee collinear input.
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(
      noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.paths.fill).toContain("A");    // arc command from capsule
    expect(result[0]!.paths.outline).toContain("A");
    expect(result[0]!.paths.fill).toBe(result[0]!.paths.outline);
  });

  // -------------------------------------------------------------------------
  // Regression: open-string acute triad — formerly rendered as an awkward
  // convex-hull triangle. Under the new path-offset geometry the contour is
  // a smooth tube tracing the voicing across strings, so no acute external
  // corner remains.
  // -------------------------------------------------------------------------

  it("(regression) open-string acute triad uses tube geometry, not a triangle hull", () => {
    // D(open) on string 3, A#(fret 1) on string 4, G(fret 3) on string 5 —
    // a skinny, acutely-angled 3-note voicing. The tube path has two
    // outside arc at the bend plus two semicircular end caps; the inside
    // corner is mitered so it does not twist through the turn. A convex-hull offset would
    // emit three corner arcs around the hull, producing a visible acute
    // angle at A#.
    const noteData = [
      makeNote(3, 0, "D", "chord-root"),
      makeNote(4, 1, "A#", "chord-tone-in-scale"),
      makeNote(5, 3, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(
      noteData, ["D", "A#", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "D",
    );
    expect(result).toHaveLength(1);
    const { paths } = result[0]!;
    expect(paths.fill.startsWith("M")).toBe(true);
    expect(paths.fill.endsWith("Z")).toBe(true);
    // Tube: 1 outside corner arc + 2 end caps = 3 A.
    const aCount = (paths.fill.match(/\bA\b/g) ?? []).length;
    expect(aCount).toBe(3);
    // Tube has 2 forward-side L's + 2 backward-side L's = 4 L commands when
    // both inside and outside corner transitions use arcs. A convex-hull
    // offset would emit 3 (one per hull edge), so a count ≥ 4 distinguishes
    // the tube geometry without depending on a specific bevel/miter detail.
    const lCount = (paths.fill.match(/\bL\b/g) ?? []).length;
    expect(lCount).toBeGreaterThanOrEqual(4);
  });
});

// -------------------------------------------------------------------------
// Regression: 3NPS Position 2 — bottom-string voicing (strings 3-4-5)
//
// C major scale, 3NPS Position 2, C major triad (C, E, G).
// The in-position chord-tone notes on the bottom three strings are:
//   str3 (D3)  fret 10 = C  (chord-root)
//   str4 (A2)  fret 10 = G  (chord-tone-in-scale)
//   str5 (E2)  fret 12 = E  (chord-tone-in-scale)
//
// Prior to the fix, two out-of-position chord tones also appeared in
// activeTones because isInPlayableContext for 3NPS only checked aggregate
// fret range (not per-coordinate shape membership):
//   str4 fret 15 = C  ("chord-root"   — in fret band but NOT in Position 2)
//   str5 fret 15 = G  ("chord-tone-in-scale" — same)
//
// The connector algorithm prefers the tightest span. For window [3,4,5]:
//   (str3-E@14, str4-C@15, str5-G@15)  span = 15-14 = 1  ← wrong winner
//   (str3-C@10, str4-G@10, str5-E@12)  span = 12-10 = 2  ← expected
//
// The fix: isInPlayableContext for 3NPS with a specific position also gates
// on per-coordinate shape membership (highlightSet.has("si-fi")) so those
// out-of-position notes become note-inactive and leave activeTones.
//
// The test models the fixed noteData (out-of-position notes marked inactive)
// and asserts the expected bottom-string voicing is emitted.
// -------------------------------------------------------------------------

describe("regression: 3NPS Position 2 bottom-string voicing", () => {
  it("emits C@str3-fret10 / G@str4-fret10 / E@str5-fret12 voicing when out-of-position notes are inactive", () => {
    // Fixed noteData: out-of-position chord tones are note-inactive.
    // In-position chord tones for 3NPS Position 2 (C major, frets 10–15):
    //   str3: C@10 (chord-root), E@14 (chord-tone-in-scale)
    //   str4: G@10 (chord-tone-in-scale)
    //   str5: E@12 (chord-tone-in-scale)
    // Out-of-position (now note-inactive after the fix):
    //   str4: C@15 (would be chord-root in-band but out of position → inactive)
    //   str5: G@15 (would be chord-tone-in-scale in-band but out of position → inactive)
    const noteData = [
      // Upper strings (in-position chord tones — upper voicings still work)
      makeNote(0, 12, "E", "chord-tone-in-scale"),
      makeNote(0, 15, "G", "chord-tone-in-scale"),
      makeNote(1, 13, "C", "chord-root"),
      makeNote(2, 12, "G", "chord-tone-in-scale"),
      // Bottom strings — in-position
      makeNote(3, 10, "C", "chord-root"),
      makeNote(3, 14, "E", "chord-tone-in-scale"),
      makeNote(4, 10, "G", "chord-tone-in-scale"),
      makeNote(4, 15, "C", "note-inactive"),   // out-of-position, now inactive
      makeNote(5, 12, "E", "chord-tone-in-scale"),
      makeNote(5, 15, "G", "note-inactive"),   // out-of-position, now inactive
    ];

    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");

    // The bottom-string voicing must be present.
    const bottomVoicing = result.find(
      (voicing) =>
        voicing.vertices.length === 3 &&
        voicing.vertices.some((v) => v.y === stringYAt(3, fretCenterX(10)) && v.x === fretCenterX(10)) &&
        voicing.vertices.some((v) => v.y === stringYAt(4, fretCenterX(10)) && v.x === fretCenterX(10)) &&
        voicing.vertices.some((v) => v.y === stringYAt(5, fretCenterX(12)) && v.x === fretCenterX(12)),
    );
    expect(bottomVoicing, "bottom-string voicing C@str3-f10 / G@str4-f10 / E@str5-f12 not emitted").toBeDefined();
    expect(bottomVoicing!.vertices).toHaveLength(3);
  });

  it("does NOT emit the tighter out-of-position voicing E@str3-f14 / C@str4-f15 / G@str5-f15 when those notes are inactive", () => {
    // Same fixed noteData as above.
    const noteData = [
      makeNote(0, 12, "E", "chord-tone-in-scale"),
      makeNote(0, 15, "G", "chord-tone-in-scale"),
      makeNote(1, 13, "C", "chord-root"),
      makeNote(2, 12, "G", "chord-tone-in-scale"),
      makeNote(3, 10, "C", "chord-root"),
      makeNote(3, 14, "E", "chord-tone-in-scale"),
      makeNote(4, 10, "G", "chord-tone-in-scale"),
      makeNote(4, 15, "C", "note-inactive"),
      makeNote(5, 12, "E", "chord-tone-in-scale"),
      makeNote(5, 15, "G", "note-inactive"),
    ];

    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");

    // The out-of-position voicing must NOT be present.
    const outOfPositionVoicing = result.find(
      (voicing) =>
        voicing.vertices.some((v) => v.y === stringYAt(4, fretCenterX(15)) && v.x === fretCenterX(15)) ||
        voicing.vertices.some((v) => v.y === stringYAt(5, fretCenterX(15)) && v.x === fretCenterX(15)),
    );
    expect(outOfPositionVoicing, "out-of-position voicing using fret-15 notes must not be emitted").toBeUndefined();
  });
});

describe("paletteIndex field", () => {
  it("includes paletteIndex in returned voicing objects", () => {
    const noteData = [
      makeNote(0, 0, "C"),
      makeNote(1, 2, "E"),
      makeNote(2, 4, "G"),
    ];
    const result = buildChordConnectorPolylines(
      noteData,
      ["C", "E", "G"],
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
      "C",
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("paletteIndex");
    expect(typeof result[0]!.paletteIndex).toBe("number");
    expect(result[0]!.paletteIndex).toBeGreaterThanOrEqual(0);
    expect(result[0]!.paletteIndex).toBeLessThan(8);
  });

  it("assigns same paletteIndex when the bass note is the same across positions", () => {
    // Both voicings have G in the bass (stringIndex 2 = lowest pick) → same
    // inversion → same color, regardless of absolute fret position.
    const noteDataPos1 = [
      makeNote(0, 0, "C"), makeNote(1, 2, "E"), makeNote(2, 4, "G"),
    ];
    // Position 2: frets 12, 13, 14 → fret positions {12,13,14} → count 3 (within limit).
    const noteDataPos2 = [
      makeNote(0, 12, "C"), makeNote(1, 13, "E"), makeNote(2, 14, "G"),
    ];

    const result1 = buildChordConnectorPolylines(
      noteDataPos1, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );
    const result2 = buildChordConnectorPolylines(
      noteDataPos2, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );

    expect(result1[0]!.paletteIndex).toBe(result2[0]!.paletteIndex);
    // G is a perfect 5th above C → 7 semitones → palette index 7.
    // Verify G (stringIndex 2 = lowest string) is still the bass at position 2.
    expect(result1[0]!.paletteIndex).toBe(7);
  });

  it("assigns different paletteIndex when bass note differs (different inversions of same chord)", () => {
    // Same chord (C major), different inversions:
    // - Voicing A: G in bass (5th in bass — second inversion). Bass interval = 7.
    // - Voicing B: C in bass (root in bass — root position). Bass interval = 0.
    const voicingGBass = [
      makeNote(0, 0, "C"), makeNote(1, 2, "E"), makeNote(2, 4, "G"),
    ];
    const voicingCBass = [
      makeNote(0, 0, "G"), makeNote(1, 2, "E"), makeNote(2, 4, "C"),
    ];

    const r1 = buildChordConnectorPolylines(
      voicingGBass, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );
    const r2 = buildChordConnectorPolylines(
      voicingCBass, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );

    expect(r1[0]!.paletteIndex).not.toBe(r2[0]!.paletteIndex);
    expect(r1[0]!.paletteIndex).toBe(7); // 5th in bass
    expect(r2[0]!.paletteIndex).toBe(0); // root in bass
  });

  it("assigns same paletteIndex across different chord qualities when bass note role is the same", () => {
    // C major triad with G in bass (5th in bass, interval 7).
    // F major triad with C in bass (5th in bass, interval 7).
    // Both are 2nd-inversion → same palette index.
    const cMajorGBass = [
      makeNote(0, 0, "C"), makeNote(1, 0, "E"), makeNote(2, 0, "G"),
    ];
    const fMajorCBass = [
      makeNote(0, 0, "F"), makeNote(1, 0, "A"), makeNote(2, 0, "C"),
    ];

    const r1 = buildChordConnectorPolylines(
      cMajorGBass, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );
    const r2 = buildChordConnectorPolylines(
      fMajorCBass, ["F", "A", "C"], fretCenterX, stringYAt, STRING_ROW_PX, "F",
    );

    expect(r1[0]!.paletteIndex).toBe(r2[0]!.paletteIndex);
    expect(r1[0]!.paletteIndex).toBe(7);
  });
});

// -------------------------------------------------------------------------
// Per-voicing offset: determinism and paletteIndex independence
//
// Phase 3 (plan 02) uses adjacency-aware cluster assignment instead of a
// static canonicalKeyHash. Each call to buildChordConnectorPolylines is
// independent — when a call contains only one voicing, it forms a singleton
// cluster and receives offset 0. Two separate calls with different note
// positions produce different path strings because the vertex coordinates
// themselves differ (different fret positions → different x values).
//
// The key property tested here: same paletteIndex does NOT guarantee the same
// path — different neck positions still produce different paths. Determinism:
// the same inputs always produce the same output.
//
// Both voicings have G on the highest-stringIndex string (string 2) → same
// paletteIndex (7) regardless of fret position.
// -------------------------------------------------------------------------

describe("per-voicing offset: determinism and paletteIndex independence", () => {
  // Voicing A: C major, G in bass, frets 1-2-3 on strings 0-1-2.
  // Singleton cluster → offsetPx = 0.
  const voicingANotes = [
    makeNote(0, 1, "C", "chord-root"),
    makeNote(1, 2, "E", "chord-tone-in-scale"),
    makeNote(2, 3, "G", "chord-tone-in-scale"),
  ];

  // Voicing B: same note names, same bass (G on str2) → same paletteIndex.
  // Frets 2-3-4 on strings 0-1-2. Singleton cluster → offsetPx = 0.
  // Different fret positions → different vertex coordinates → different path.
  const voicingBNotes = [
    makeNote(0, 2, "C", "chord-root"),
    makeNote(1, 3, "E", "chord-tone-in-scale"),
    makeNote(2, 4, "G", "chord-tone-in-scale"),
  ];

  it("(a) same paletteIndex but different canonicalKey → different paths.fill strings", () => {
    const rA = buildChordConnectorPolylines(voicingANotes, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    const rB = buildChordConnectorPolylines(voicingBNotes, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");

    expect(rA).toHaveLength(1);
    expect(rB).toHaveLength(1);

    // Confirm same paletteIndex (same inversion — G in bass for both).
    expect(rA[0]!.paletteIndex).toBe(rB[0]!.paletteIndex);

    // Different fret positions → different vertex coordinates → different path strings,
    // even though both receive offset 0 as singleton clusters.
    expect(rA[0]!.paths.fill).not.toBe(rB[0]!.paths.fill);
  });

  it("(b) same canonicalKey always produces the same paths.fill string (deterministic)", () => {
    const result1 = buildChordConnectorPolylines(voicingANotes, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    const result2 = buildChordConnectorPolylines(voicingANotes, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");

    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
    expect(result1[0]!.paths.fill).toBe(result2[0]!.paths.fill);
  });

  it("(c) adaptive radius factors use compact, medium, and max widths", () => {
    expect(CHORD_CONNECTOR_RADIUS_FACTORS).toEqual({
      compact: 0.34,
      medium: 0.38,
      max: 0.42,
    });
  });

  it("(c) same-fret / one-position voicings are floored above the chord-root squircle", () => {
    const sameFret = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];

    // Chord-root squircle radius follows the rendered bubble minus the 3px
    // squircle reduction: round(36 × 0.8) × 0.5 × 0.86 - 3 = 9.47.
    // The compact factor (0.34 × 36 = 12.24) now exceeds the floor
    // (9.47 + 2 = 11.47), so the factor wins.
    const computedRadius = computeChordConnectorRadiusPx(sameFret, STRING_ROW_PX, 0);
    const chordRootRadius = chordRootVisualRadiusPx(STRING_ROW_PX);
    expect(computedRadius).toBeGreaterThan(chordRootRadius);
    expect(computedRadius).toBeCloseTo(12.24);
  });

  it("(c) 2-position and 3-position voicings produce progressively wider radii", () => {
    const twoPositions = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 2, "E", "chord-tone-in-scale"),
      makeNote(2, 3, "G", "chord-tone-in-scale"),
    ];
    const threePositions = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 3, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
    ];

    const twoPositionRadius = computeChordConnectorRadiusPx(twoPositions, STRING_ROW_PX, 0);
    const threePositionRadius = computeChordConnectorRadiusPx(threePositions, STRING_ROW_PX, 0);

    // Both factors exceed the reduced 11.47 floor, so span-based sizing
    // governs: medium (0.38 × 36 = 13.68), max (0.42 × 36 = 15.12).
    expect(twoPositionRadius).toBeCloseTo(13.68);
    expect(threePositionRadius).toBeCloseTo(15.12);
    expect(threePositionRadius).toBeGreaterThan(twoPositionRadius);
  });

  it("(c) crowded-cluster radius remains capped below the old widest envelope", () => {
    const maxWidthVoicing = [
      makeNote(0, 2, "C", "chord-root"),
      makeNote(1, 3, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
    ];

    const newMaxEnvelope = computeChordConnectorRadiusPx(maxWidthVoicing, STRING_ROW_PX, 6);
    const oldMaxEnvelope = STRING_ROW_PX * 0.47 + 10;

    expect(newMaxEnvelope).toBeCloseTo(21.12);
    expect(newMaxEnvelope).toBeLessThan(oldMaxEnvelope);
  });

  it("clamps connector radius to the available SVG y bounds", () => {
    const preferredRadius = STRING_ROW_PX * CHORD_CONNECTOR_RADIUS_FACTORS.max;
    const radius = clampConnectorRadiusToYBounds(
      [{ x: 500, y: 15.12 }, { x: 548, y: 15.12 }],
      preferredRadius,
      { minY: 0, maxY: STRING_ROW_PX * 6 },
    );

    expect(radius).toBeLessThan(preferredRadius);
    expect(radius).toBeCloseTo(14.12, 2);
  });

  it("edge-safe radius can shrink below the squircle floor only when requested", () => {
    const preferredRadius = STRING_ROW_PX * CHORD_CONNECTOR_RADIUS_FACTORS.max;
    const vertices = [{ x: 500, y: 12 }, { x: 548, y: 12 }];
    const yBounds = { minY: 0, maxY: STRING_ROW_PX * 6 };

    const middleRadius = resolveConnectorRadiusPx({
      vertices,
      preferredRadius,
      yBounds,
      edgeSafe: false,
    });
    const edgeRadius = resolveConnectorRadiusPx({
      vertices,
      preferredRadius,
      yBounds,
      edgeSafe: true,
    });

    expect(middleRadius).toBe(preferredRadius);
    expect(edgeRadius).toBeCloseTo(11, 2);
    expect(edgeRadius).toBeLessThan(chordRootVisualRadiusPx(STRING_ROW_PX) + 2);
  });
});

describe("useChordConnectorPolylines", () => {
  it("recomputes paths when resize changes fret/string geometry", () => {
    const noteData = [
      makeNote(0, 1, "C", "chord-root"),
      makeNote(1, 2, "E", "chord-tone-in-scale"),
      makeNote(2, 3, "G", "chord-tone-in-scale"),
    ];
    const chordToneNames = ["C", "E", "G"];
    const wideFretCenterX = (fi: number) => fi * 20;
    const compactFretCenterX = (fi: number) => fi * 10;
    const tallStringYAt = (si: number) => si * 24;
    const compactStringYAt = (si: number) => si * 18;

    const { result, rerender } = renderHook(
      ({
        fretCenterX,
        stringYAt,
      }: {
        fretCenterX: (fretIndex: number) => number;
        stringYAt: (stringIndex: number, x: number) => number;
      }) =>
        useChordConnectorPolylines({
          noteData,
          chordToneNames,
          fretCenterX,
          stringYAt,
          stringRowPx: STRING_ROW_PX,
          chordRoot: "C",
        }),
      {
        initialProps: {
          fretCenterX: wideFretCenterX,
          stringYAt: tallStringYAt,
        },
      },
    );

    const initialPath = result.current[0]!.paths.fill;
    expect(result.current[0]!.vertices.map((v) => v.x)).toEqual([20, 40, 60]);
    expect(result.current[0]!.vertices.map((v) => v.y)).toEqual([0, 24, 48]);

    rerender({
      fretCenterX: compactFretCenterX,
      stringYAt: compactStringYAt,
    });

    expect(result.current[0]!.paths.fill).not.toBe(initialPath);
    expect(result.current[0]!.vertices.map((v) => v.x)).toEqual([10, 20, 30]);
    expect(result.current[0]!.vertices.map((v) => v.y)).toEqual([0, 18, 36]);
  });
});

// -------------------------------------------------------------------------
// Adjacency-aware offset assignment (plan 03-02)
//
// detectOverlapClusters uses inflated AABB union-find to cluster voicings
// whose envelopes overlap. assignClusterOffsets sorts each cluster by
// canonicalKey and assigns OFFSET_BUCKET[i % OFFSET_BUCKET.length].
//
// Geometry parameters (used to derive overlap expectations):
//   fretCenterX(fi) = fi * 10  → 10 px per fret
//   stringYAt(si) = si * 20    → 20 px per string
//   STRING_ROW_PX = 36
//   baseRadius = 36 * 0.47 ≈ 16.92 px
//   maxBucketOffset = 10 px (OFFSET_BUCKET last element)
//   inflateBy = baseRadius + maxBucketOffset ≈ 26.92 px
//
// Two voicings on the same strings overlap in y automatically. In x they
// overlap if their fret positions are within 2 * 26.92 / 10 ≈ 5.4 frets.
//
// "Far apart" = fret distance > 5.4 (e.g. frets 1-3 vs 9-11 → gap ≥ 6 frets).
// -------------------------------------------------------------------------

describe("adjacency-aware offset assignment", () => {
  // -------------------------------------------------------------------------
  // (1) Two AABB-overlapping voicings get different offsets.
  //
  // Two voicings from adjacent string windows at the same fret — V1 on
  // strings 0-1-2 and V2 on strings 1-2-3, both at fret 5.
  // Same x (fret 5 = x 50); y ranges [0,40] and [20,60] share strings 1-2.
  // inflateBy ≈ 27 px → inflated y ranges [-26.92,66.92] and [-6.92,86.92]
  // → pairwise AABB-overlap ✓.
  // Cluster of size 2: sorted by canonicalKey → member 0 gets OFFSET_BUCKET[0]=0,
  // member 1 gets OFFSET_BUCKET[1]=2 → different radii → different path strings.
  // -------------------------------------------------------------------------
  it("(1) two AABB-overlapping voicings receive distinct offsets", () => {
    // Adjacent string windows at fret 5:
    //   str0=C, str1=E, str2=G, str3=C  → windows [0,1,2] and [1,2,3]
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
      makeNote(3, 5, "C", "chord-root"),
    ];

    const result = buildChordConnectorPolylines(
      noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );

    expect(result).toHaveLength(2);
    // Both voicings are emitted; their overlapping AABBs → cluster of size 2.
    // Different OFFSET_BUCKET entries → different path strings.
    expect(result[0]!.paths.fill).not.toBe(result[1]!.paths.fill);
  });

  // -------------------------------------------------------------------------
  // (2) Three overlapping voicings get three distinct offsets.
  //
  // Three voicings from adjacent string windows at fret 5 — windows
  // [0,1,2], [1,2,3], [2,3,4]. All pairwise AABB-overlap:
  //   [0-2] inflated y max = 40+27 = 67 > [2-4] inflated y min = 40-27 = 13 ✓
  // Cluster of size 3 → three distinct OFFSET_BUCKET entries → pairwise distinct paths.
  // -------------------------------------------------------------------------
  it("(2) three AABB-overlapping voicings receive three distinct offsets", () => {
    // str0=C, str1=E, str2=G, str3=C, str4=E → windows [0,1,2],[1,2,3],[2,3,4]
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
      makeNote(3, 5, "C", "chord-root"),
      makeNote(4, 5, "E", "chord-tone-in-scale"),
    ];

    const result = buildChordConnectorPolylines(
      noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );

    expect(result).toHaveLength(3);
    const fillPaths = result.map((v) => v.paths.fill);
    // All three paths must be pairwise distinct.
    const uniquePaths = new Set(fillPaths);
    expect(uniquePaths.size).toBe(3);
  });

  // -------------------------------------------------------------------------
  // (3) Non-overlapping voicings both get offset 0.
  //
  // Two voicings on strings 0-1-2 at frets 1-2-3 and frets 9-10-11.
  // Fret gap ≈ 8 frets > 5.4 fret overlap threshold → separate singleton
  // clusters → both receive OFFSET_BUCKET[0] = 0.
  //
  // Baseline: a single voicing at frets 1-2-3 also receives offset 0 (singleton).
  // The two-voicing call should produce paths byte-identical to their
  // respective single-voicing baselines.
  // -------------------------------------------------------------------------
  it("(3) non-overlapping voicings both receive offset 0 (same as singleton baseline)", () => {
    // Baseline: single voicing at frets 1-2-3 → offset 0.
    const baseline1 = buildChordConnectorPolylines(
      [makeNote(0, 1, "C", "chord-root"), makeNote(1, 2, "E", "chord-tone-in-scale"), makeNote(2, 3, "G", "chord-tone-in-scale")],
      ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );
    // Baseline: single voicing at frets 9-10-11 → offset 0.
    const baseline2 = buildChordConnectorPolylines(
      [makeNote(0, 9, "C", "chord-root"), makeNote(1, 10, "E", "chord-tone-in-scale"), makeNote(2, 11, "G", "chord-tone-in-scale")],
      ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );

    expect(baseline1).toHaveLength(1);
    expect(baseline2).toHaveLength(1);

    // Combined: two far-apart voicings in one call.
    const combined = buildChordConnectorPolylines(
      [
        makeNote(0, 1, "C", "chord-root"),
        makeNote(1, 2, "E", "chord-tone-in-scale"),
        makeNote(2, 3, "G", "chord-tone-in-scale"),
        makeNote(0, 9, "C", "chord-root"),
        makeNote(1, 10, "E", "chord-tone-in-scale"),
        makeNote(2, 11, "G", "chord-tone-in-scale"),
      ],
      ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );

    expect(combined.length).toBeGreaterThanOrEqual(2);

    const voicing1 = combined.find((v) => v.vertices.some((p) => p.x === fretCenterX(1)));
    const voicing2 = combined.find((v) => v.vertices.some((p) => p.x === fretCenterX(9)));
    expect(voicing1).toBeDefined();
    expect(voicing2).toBeDefined();

    // Both non-overlapping voicings should have the same path as their singleton baselines.
    expect(voicing1!.paths.fill).toBe(baseline1[0]!.paths.fill);
    expect(voicing2!.paths.fill).toBe(baseline2[0]!.paths.fill);
  });

  // -------------------------------------------------------------------------
  // (4) Determinism: identical inputs always produce identical per-voicing offsets.
  //
  // Run buildChordConnectorPolylines twice with the same noteData. Assert that
  // per-index paths.fill strings match exactly.
  // -------------------------------------------------------------------------
  it("(4) determinism: same inputs produce identical per-voicing offsets across re-runs", () => {
    // Three adjacent string windows at fret 5 (same data as test 2).
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
      makeNote(3, 5, "C", "chord-root"),
      makeNote(4, 5, "E", "chord-tone-in-scale"),
    ];

    const run1 = buildChordConnectorPolylines(
      noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );
    const run2 = buildChordConnectorPolylines(
      noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );

    expect(run1.length).toBe(run2.length);
    run1.forEach((v, i) => {
      expect(v.paths.fill).toBe(run2[i]!.paths.fill);
    });
  });

  // -------------------------------------------------------------------------
  // (5) Cluster size 6 stress: six overlapping voicings all get distinct paths.
  //
  // Six voicings from adjacent 4-string windows on strings 0-8, all at fret 5.
  // chord ["C","E","G","B"] with repeating pattern C,E,G,B,C,E,G,B,C on str0-8.
  // Windows [0-3],[1-4],[2-5],[3-6],[4-7],[5-8] → 6 voicings.
  //
  // All-pairwise AABB-overlap proof (most distant pair: window 0-3 vs 5-8):
  //   [0-3]: y=[0,60], inflated y max = 60 + 26.92 = 86.92
  //   [5-8]: y=[100,160], inflated y min = 100 - 26.92 = 73.08
  //   73.08 < 86.92 → overlap ✓
  // x is identical for all (fret 5 = x 50) → x AABB always overlaps.
  //
  // Single cluster of size 6 → 6 distinct OFFSET_BUCKET entries → pairwise distinct paths.
  // -------------------------------------------------------------------------
  it("(5) cluster of 6 voicings: all six paths.fill strings are pairwise distinct", () => {
    // Cmaj7 pattern C,E,G,B across strings 0-8 at fret 5.
    // Each 4-string window [s, s+3] covers one rotation of {C,E,G,B}.
    const pattern = ["C", "E", "G", "B", "C", "E", "G", "B", "C"] as const;
    const roleMap: Record<string, string> = {
      C: "chord-root",
      E: "chord-tone-in-scale",
      G: "chord-tone-in-scale",
      B: "chord-tone-in-scale",
    };
    const noteData = pattern.map((name, si) => makeNote(si, 5, name, roleMap[name]!));

    const result = buildChordConnectorPolylines(
      noteData, ["C", "E", "G", "B"], fretCenterX, stringYAt, STRING_ROW_PX, "C",
    );

    // Should emit exactly 6 voicings (one per 4-string window 0-3 through 5-8).
    expect(result).toHaveLength(6);

    // All 6 path strings must be pairwise distinct (cluster-based offset assignment).
    const fills = result.map((v) => v.paths.fill);
    const uniqueFills = new Set(fills);
    expect(uniqueFills.size).toBe(6);
  });
});

// -------------------------------------------------------------------------
// Overlap offset regression: G major triad on full neck
//
// C major scale, degree V (G major = G, B, D).
// Standard tuning high-to-low: E4(str0) B3(str1) G3(str2) D3(str3) A2(str4) E2(str5)
//
// Chord-tone positions (frets 0–22):
//   G: str0@{3,15}, str1@{8,20}, str2@{0,12}, str3@{5,17}, str4@{10,22}, str5@{3,15}
//   B: str0@{7,19}, str1@{0,12}, str2@{4,16}, str3@{9,21}, str4@{2,14}, str5@{7,19}
//   D: str0@{10,22}, str1@{3,15}, str2@{7,19}, str3@{0,12}, str4@{5,17}, str5@{10,22}
//
// The E-shape CAGED voicings cluster around frets 7–10 and repeat at 19–22.
// Both groups should receive independent offset budgets so their
// overlapping connectors are visually separated.
// -------------------------------------------------------------------------

describe("G major triad overlap offsets (full neck)", () => {
  // All G-major chord tones on 6 strings, frets 0–22.
  function gMajorChordTones(): NoteData[] {
    const tones: Array<[number, number, string, string]> = [
      // G positions
      [0, 3, "G", "chord-tone-in-scale"], [0, 15, "G", "chord-tone-in-scale"],
      [1, 8, "G", "chord-tone-in-scale"], [1, 20, "G", "chord-tone-in-scale"],
      [2, 0, "G", "chord-root"],          [2, 12, "G", "chord-root"],
      [3, 5, "G", "chord-tone-in-scale"], [3, 17, "G", "chord-tone-in-scale"],
      [4, 10, "G", "chord-tone-in-scale"],[4, 22, "G", "chord-tone-in-scale"],
      [5, 3, "G", "chord-tone-in-scale"], [5, 15, "G", "chord-tone-in-scale"],
      // B positions
      [0, 7, "B", "chord-tone-in-scale"], [0, 19, "B", "chord-tone-in-scale"],
      [1, 0, "B", "chord-tone-in-scale"], [1, 12, "B", "chord-tone-in-scale"],
      [2, 4, "B", "chord-tone-in-scale"], [2, 16, "B", "chord-tone-in-scale"],
      [3, 9, "B", "chord-tone-in-scale"], [3, 21, "B", "chord-tone-in-scale"],
      [4, 2, "B", "chord-tone-in-scale"], [4, 14, "B", "chord-tone-in-scale"],
      [5, 7, "B", "chord-tone-in-scale"], [5, 19, "B", "chord-tone-in-scale"],
      // D positions
      [0, 10, "D", "chord-tone-in-scale"],[0, 22, "D", "chord-tone-in-scale"],
      [1, 3, "D", "chord-tone-in-scale"], [1, 15, "D", "chord-tone-in-scale"],
      [2, 7, "D", "chord-tone-in-scale"], [2, 19, "D", "chord-tone-in-scale"],
      [3, 0, "D", "chord-tone-in-scale"], [3, 12, "D", "chord-tone-in-scale"],
      [4, 5, "D", "chord-tone-in-scale"], [4, 17, "D", "chord-tone-in-scale"],
      [5, 10, "D", "chord-tone-in-scale"],[5, 22, "D", "chord-tone-in-scale"],
    ];
    return tones.map(([si, fi, name, cls]) => makeNote(si, fi, name, cls));
  }

  // Helper: extract voicings whose vertices fall within a fret range.
  function voicingsInFretRange(
    voicings: ReturnType<typeof buildChordConnectorPolylines>,
    minFret: number,
    maxFret: number,
  ) {
    return voicings.filter((v) => {
      const frets = v.voicingKey.split("|").map((p) => Number(p.split(",")[1]));
      return frets.every((f) => f >= minFret && f <= maxFret);
    });
  }

  // Helper: check if two voicingKeys share a (string,fret) position.
  function keysSharePosition(a: string, b: string): boolean {
    const setA = new Set(a.split("|"));
    for (const pos of b.split("|")) {
      if (setA.has(pos)) return true;
    }
    return false;
  }

  it("produces voicings in both the fret 7–10 and 19–22 regions", () => {
    const result = buildChordConnectorPolylines(
      gMajorChordTones(), ["G", "B", "D"], fretCenterX, stringYAt, STRING_ROW_PX, "G",
    );

    const low = voicingsInFretRange(result, 7, 10);
    const high = voicingsInFretRange(result, 19, 22);

    expect(low.length).toBeGreaterThanOrEqual(3);
    expect(high.length).toBeGreaterThanOrEqual(3);
  });

  it("frets 7–10: overlapping voicings have distinct paths", () => {
    const result = buildChordConnectorPolylines(
      gMajorChordTones(), ["G", "B", "D"], fretCenterX, stringYAt, STRING_ROW_PX, "G",
    );

    const group = voicingsInFretRange(result, 7, 10);
    // Every pair that shares a position must have different paths.
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (keysSharePosition(group[i]!.voicingKey, group[j]!.voicingKey)) {
          expect(
            group[i]!.paths.fill,
            `frets 7-10: voicings "${group[i]!.voicingKey}" and "${group[j]!.voicingKey}" share a position but have identical paths (same radius)`,
          ).not.toBe(group[j]!.paths.fill);
        }
      }
    }
  });

  it("frets 19–22: overlapping voicings have distinct paths", () => {
    const result = buildChordConnectorPolylines(
      gMajorChordTones(), ["G", "B", "D"], fretCenterX, stringYAt, STRING_ROW_PX, "G",
    );

    const group = voicingsInFretRange(result, 19, 22);
    // Every pair that shares a position must have different paths.
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (keysSharePosition(group[i]!.voicingKey, group[j]!.voicingKey)) {
          expect(
            group[i]!.paths.fill,
            `frets 19-22: voicings "${group[i]!.voicingKey}" and "${group[j]!.voicingKey}" share a position but have identical paths (same radius)`,
          ).not.toBe(group[j]!.paths.fill);
        }
      }
    }
  });

  it("non-overlapping voicings share the same (minimal) offset", () => {
    const result = buildChordConnectorPolylines(
      gMajorChordTones(), ["G", "B", "D"], fretCenterX, stringYAt, STRING_ROW_PX, "G",
    );

    const group = voicingsInFretRange(result, 7, 10);
    // Non-overlapping pairs should share the same radius.
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (!keysSharePosition(group[i]!.voicingKey, group[j]!.voicingKey)) {
          const rxI = parseFloat(group[i]!.paths.fill.match(/A ([\d.]+)/)?.[1] ?? "0");
          const rxJ = parseFloat(group[j]!.paths.fill.match(/A ([\d.]+)/)?.[1] ?? "0");
          expect(
            rxI,
            `non-overlapping voicings "${group[i]!.voicingKey}" and "${group[j]!.voicingKey}" should share the same radius`,
          ).toBeCloseTo(rxJ, 1);
        }
      }
    }
  });

  it("frets 7-10 and 19-22 receive independent offset budgets", () => {
    const result = buildChordConnectorPolylines(
      gMajorChordTones(), ["G", "B", "D"], fretCenterX, stringYAt, STRING_ROW_PX, "G",
    );

    const baseRadius = STRING_ROW_PX * CHORD_CONNECTOR_BASE_RADIUS_FACTOR;

    // Both regions should have the same offset distribution (isomorphic shapes).
    const extractOffsets = (minF: number, maxF: number) =>
      voicingsInFretRange(result, minF, maxF)
        .map((v) => {
          const rx = parseFloat(v.paths.fill.match(/A ([\d.]+)/)?.[1] ?? "0");
          return Math.round(rx - baseRadius);
        })
        .sort((a, b) => a - b);

    const offsets7 = extractOffsets(7, 10);
    const offsets19 = extractOffsets(19, 22);

    expect(offsets7).toEqual(offsets19);
    // Verify they use minimal offsets (0 and CONNECTOR_OFFSET_STEP=3).
    expect(offsets7).toEqual([0, 3, 3]);
  });

  it("yBounds clamping does not erase offset differentiation", () => {
    // With yBounds, edge voicings (touching str0 or str5) get clamped.
    // The post-clamp fix should ensure overlapping pairs still differ.
    // stringYAt = si * 20 → str0=0, str5=100. neckHeight = 100.
    const yBounds = { minY: 0, maxY: 100 };

    const result = buildChordConnectorPolylines(
      gMajorChordTones(), ["G", "B", "D"], fretCenterX, stringYAt, STRING_ROW_PX, "G", yBounds,
    );

    const group = voicingsInFretRange(result, 19, 22);
    // Every pair sharing a position must have distinct paths even after clamping.
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (keysSharePosition(group[i]!.voicingKey, group[j]!.voicingKey)) {
          expect(
            group[i]!.paths.fill,
            `yBounds clamped: "${group[i]!.voicingKey}" and "${group[j]!.voicingKey}" share a position but have identical paths`,
          ).not.toBe(group[j]!.paths.fill);
        }
      }
    }
  });
});

// -------------------------------------------------------------------------
// voicingKey: stability, uniqueness, and order-independence
// -------------------------------------------------------------------------

describe("voicingKey field", () => {
  it("voicingKey stability: same vertex set on two separate calls produces identical voicingKey values", () => {
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const result1 = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    const result2 = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
    expect(result1[0]!.voicingKey).toBe(result2[0]!.voicingKey);
  });

  it("voicingKey uniqueness: two voicings with distinct vertex sets produce different keys", () => {
    // Two distinct positions: strings 0-1-2 at fret 5, and strings 0-1-2 at fret 7.
    // Both are separate calls so each emits 1 voicing with a different key.
    const noteDataA = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 5, "G", "chord-tone-in-scale"),
    ];
    const noteDataB = [
      makeNote(0, 7, "C", "chord-root"),
      makeNote(1, 7, "E", "chord-tone-in-scale"),
      makeNote(2, 7, "G", "chord-tone-in-scale"),
    ];
    const rA = buildChordConnectorPolylines(noteDataA, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    const rB = buildChordConnectorPolylines(noteDataB, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(rA).toHaveLength(1);
    expect(rB).toHaveLength(1);
    expect(rA[0]!.voicingKey).not.toBe(rB[0]!.voicingKey);
  });

  it("canonicalKey order-independence: supplying the same vertices in a different order yields the same key", () => {
    // Forward order: string 0, 1, 2.
    const noteDataForward = [
      makeNote(0, 3, "C", "chord-root"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(2, 4, "G", "chord-tone-in-scale"),
    ];
    // Reverse order: string 2, 1, 0 — NoteData ordering should not affect the key.
    const noteDataReverse = [
      makeNote(2, 4, "G", "chord-tone-in-scale"),
      makeNote(1, 5, "E", "chord-tone-in-scale"),
      makeNote(0, 3, "C", "chord-root"),
    ];
    const rFwd = buildChordConnectorPolylines(noteDataForward, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    const rRev = buildChordConnectorPolylines(noteDataReverse, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(rFwd).toHaveLength(1);
    expect(rRev).toHaveLength(1);
    expect(rFwd[0]!.voicingKey).toBe(rRev[0]!.voicingKey);
  });

  it("voicingKey is a non-empty string containing the expected coordinate pairs", () => {
    const noteData = [
      makeNote(0, 5, "C", "chord-root"),
      makeNote(1, 7, "E", "chord-tone-in-scale"),
      makeNote(2, 6, "G", "chord-tone-in-scale"),
    ];
    const result = buildChordConnectorPolylines(noteData, ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX, "C");
    expect(result).toHaveLength(1);
    const key = result[0]!.voicingKey;
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
    // Key must contain each (stringIndex,fretIndex) pair in sorted order joined by "|".
    // Sorted: "0,5" < "1,7" < "2,6" → sorted: "0,5", "1,7", "2,6".
    expect(key).toContain("0,5");
    expect(key).toContain("1,7");
    expect(key).toContain("2,6");
  });

  // -------------------------------------------------------------------------
  // INTERVAL_TO_PALETTE — collision-free mapping
  // -------------------------------------------------------------------------

  describe("INTERVAL_TO_PALETTE", () => {
    it("maps all 12 semitone intervals to valid palette indices 0-7", () => {
      expect(INTERVAL_TO_PALETTE).toHaveLength(12);
      for (const slot of INTERVAL_TO_PALETTE) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThanOrEqual(7);
      }
    });

    it.each([
      { name: "augmented triad", intervals: [0, 4, 8] },
      { name: "diminished 7th", intervals: [0, 3, 6, 9] },
      { name: "dominant 7th", intervals: [0, 4, 7, 10] },
      { name: "major 7th", intervals: [0, 4, 7, 11] },
      { name: "minor 7th", intervals: [0, 3, 7, 10] },
      { name: "augmented 7th", intervals: [0, 4, 8, 10] },
      { name: "minor-major 7th", intervals: [0, 3, 7, 11] },
      { name: "half-diminished 7th", intervals: [0, 3, 6, 10] },
    ])("produces distinct palette indices for $name ($intervals)", ({ intervals }) => {
      const mapped = intervals.map((i) => INTERVAL_TO_PALETTE[i]);
      const unique = new Set(mapped);
      expect(unique.size).toBe(intervals.length);
    });
  });

  // -------------------------------------------------------------------------
  // Augmented triad inversions get distinct colors
  // -------------------------------------------------------------------------

  it("augmented triad inversions (E aug: E, G#, C) receive distinct paletteIndex values", () => {
    // E augmented triad: E (root), G# (maj 3rd), C (aug 5th = enharmonic B#)
    // Three voicings on strings 0-2, each with a different bass note on string 2.
    // Frets kept within MAX_FRET_SPAN (5) per voicing.
    const noteData = [
      // Voicing 1: E in bass (string 2) — root position, interval 0
      // Frets 4,5,4 → fretted span = 5-4+1 = 2 ✓
      makeNote(0, 4, "G#", "chord-tone-in-scale"),
      makeNote(1, 5, "C", "chord-tone-in-scale"),
      makeNote(2, 4, "E", "chord-tone-in-scale"),
      // Voicing 2: G# in bass (string 2) — 1st inversion, interval 4
      makeNote(0, 8, "C", "chord-tone-in-scale"),
      makeNote(1, 9, "E", "chord-tone-in-scale"),
      makeNote(2, 8, "G#", "chord-tone-in-scale"),
      // Voicing 3: C in bass (string 2) — 2nd inversion, interval 8
      makeNote(0, 12, "E", "chord-tone-in-scale"),
      makeNote(1, 13, "G#", "chord-tone-in-scale"),
      makeNote(2, 12, "C", "chord-tone-in-scale"),
    ];

    const result = buildChordConnectorPolylines(
      noteData,
      ["E", "G#", "C"],
      fretCenterX,
      stringYAt,
      STRING_ROW_PX,
      "E",
    );

    expect(result.length).toBeGreaterThanOrEqual(3);

    const paletteIndices = result.map((v) => v.paletteIndex);
    const unique = new Set(paletteIndices);
    // All three inversions must have distinct palette indices.
    expect(unique.size).toBe(paletteIndices.length);
  });
});
