import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { CagedShape } from "@fretflow/core";
import {
  buildChordConnectorPolylines,
  buildPendingChordConnectorVoicings,
  buildPixelChordConnectorVoicings,
  MAX_PLAYABLE_FRET_POSITIONS,
  CHORD_TONE_CLASSES,
  useChordConnectorPolylines,
} from "./useChordConnectorPolylines";
import {
  clampConnectorRadiusToYBounds,
  CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
  CHORD_CONNECTOR_RADIUS_FACTORS,
  computeChordConnectorRadiusPx,
  resolveConnectorRadiusPx,
} from "../utils/connectorRadius";
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

type NoteSpec = [si: number, fi: number, name: string, role?: string];
const notes = (specs: NoteSpec[]): NoteData[] =>
  specs.map(([si, fi, name, role]) => makeNote(si, fi, name, role ?? "chord-tone-in-scale"));

function build(
  noteData: NoteData[],
  chordToneNames: string[],
  yBounds?: { minY: number; maxY: number },
) {
  return buildChordConnectorPolylines(
    noteData,
    chordToneNames,
    fretCenterX,
    stringYAt,
    STRING_ROW_PX,
    yBounds,
  );
}

// True iff any vertex sits at the (stringIndex, fretIndex) grid position.
const hasVertex = (vertices: ReadonlyArray<{ x: number; y: number }>, si: number, fi: number) =>
  vertices.some((p) => p.x === fretCenterX(fi) && p.y === stringYAt(si, fretCenterX(fi)));

// Find a voicing with vertices at every (string, fret) pair (and exact length if given).
const findVoicing = (
  result: ReturnType<typeof buildChordConnectorPolylines>,
  positions: Array<[number, number]>,
  exactLen?: number,
) =>
  result.find(
    (v) =>
      (exactLen === undefined || v.vertices.length === exactLen) &&
      positions.every(([si, fi]) => hasVertex(v.vertices, si, fi)),
  );

describe("buildChordConnectorPolylines", () => {
  // -------------------------------------------------------------------------
  // Edge cases — empty / insufficient data
  // -------------------------------------------------------------------------

  it("returns [] for empty noteData", () => {
    const result = buildChordConnectorPolylines([], ["C", "E", "G"], fretCenterX, stringYAt, STRING_ROW_PX);
    expect(result).toEqual([]);
  });

  describe("useChordConnectorPolylines explicit voicings", () => {
    type ExplicitNote = { stringIndex: number; fretIndex: number; noteName: string };
    const renderExplicit = (notes: ExplicitNote[], voicingKey = "e-shape-c-major") =>
      renderHook(() =>
        useChordConnectorPolylines({
          noteData: [],
          chordToneNames: ["C", "E", "G"],
          fretCenterX, stringYAt, stringRowPx: STRING_ROW_PX,
          explicitVoicings: [{ shape: "E" as CagedShape, voicingKey, notes }],
        }),
      ).result;

    const inOrder: ExplicitNote[] = [
      { stringIndex: 0, fretIndex: 8, noteName: "C" },
      { stringIndex: 1, fretIndex: 8, noteName: "G" },
      { stringIndex: 2, fretIndex: 9, noteName: "E" },
      { stringIndex: 3, fretIndex: 10, noteName: "C" },
      { stringIndex: 4, fretIndex: 10, noteName: "G" },
      { stringIndex: 5, fretIndex: 8, noteName: "C" },
    ];
    const shuffled = [inOrder[5]!, inOrder[3]!, inOrder[1]!, inOrder[4]!, inOrder[0]!, inOrder[2]!];

    it("builds exactly one connector from an explicit 6-string E-shape voicing", () => {
      const r = renderExplicit(inOrder);
      expect(r.current).toHaveLength(1);
      expect(r.current[0]?.voicingKey).toBe("e-shape-c-major");
      expect(r.current[0]?.shape).toBe("E");
      expect(r.current[0]?.vertices).toHaveLength(6);
    });

    it("orders explicit voicing geometry by string index even when notes are passed out of order", () => {
      const r = renderExplicit(shuffled, "e-shape-c-major-shuffled");
      expect(r.current[0]?.vertices.map((v) => v.y)).toEqual([0, 20, 40, 60, 80, 100]);
    });
  });

  it.each<{ label: string; specs: NoteSpec[]; chord: string[] }>([
    {
      label: "chordToneNames has fewer than 2 entries",
      specs: [[0, 5, "C"], [1, 5, "E"]],
      chord: ["C"],
    },
    {
      label: "all noteData entries have non-chord-tone noteClass",
      specs: [[0, 3, "C", "note-active"], [1, 5, "E", "note-active"]],
      chord: ["C", "E", "G"],
    },
    {
      label: "all chord-tone entries are note-inactive (shape-filtered)",
      specs: [[0, 3, "C", "note-inactive"], [1, 5, "E", "note-inactive"], [2, 3, "G", "note-inactive"]],
      chord: ["C", "E", "G"],
    },
  ])("returns [] when $label", ({ specs, chord }) => {
    expect(build(notes(specs), chord)).toEqual([]);
  });

  it("shape-scoped CAGED behavior: different active chord-tone sets produce different voicings", () => {
    const eShape = build(
      notes([[0, 3, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"]]),
      ["C", "E", "G"],
    );
    const gShape = build(
      notes([[1, 5, "E"], [2, 5, "C", "chord-root"], [3, 5, "G"]]),
      ["C", "E", "G"],
    );
    expect(eShape.map((v) => v.voicingKey)).not.toEqual(gShape.map((v) => v.voicingKey));
  });

  it("(a) triad on 3 strings: emits 1 voicing with 3 vertices spanning strings 0-2", () => {
    const result = build(
      notes([[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"]]),
      ["C", "E", "G"],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.vertices).toHaveLength(3);
    const yValues = result[0]!.vertices.map((v) => v.y).sort((a, b) => a - b);
    expect(yValues).toEqual([0, 20, 40]);
  });

  it("(b) multiple candidate positions emit voicings covering all chord tones", () => {
    // String 1 has both E@3 and E@5 → algorithm picks one to form a valid (C,E,G) triad.
    const result = build(
      notes([[0, 3, "C", "chord-root"], [1, 3, "E"], [1, 5, "E"], [2, 3, "G"]]),
      ["C", "E", "G"],
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((v) => expect(v.vertices).toHaveLength(3));
    const yValues = result[0]!.vertices.map((v) => v.y);
    expect(yValues).toContain(stringYAt(0, fretCenterX(3)));
    expect(yValues).toContain(stringYAt(2, fretCenterX(3)));
  });

  it("(c) shape filter: note-inactive chord tones blocked from voicings", () => {
    // String 2 G is inactive → triad C-E-G has no candidate for the third tone
    // on any consecutive 3-string window.
    const result = build(
      notes([[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G", "note-inactive"], [3, 5, "B"]]),
      ["C", "E", "G"],
    );
    expect(result).toHaveLength(0);
  });

  it("(c) inactive positions on the same string skipped; active ones still form a voicing", () => {
    const result = build(
      notes([[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"], [2, 7, "A", "note-inactive"]]),
      ["C", "E", "G"],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.vertices.some((v) => v.x === fretCenterX(7))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // (d) Playability filter — voicings span at most MAX_PLAYABLE_FRET_POSITIONS
  // fretted positions; open strings are excluded from the span calculation.
  // -------------------------------------------------------------------------

  it.each<{ label: string; specs: NoteSpec[]; chord: string[]; expected: 0 | 1 }>([
    {
      label: `exactly MAX_PLAYABLE_FRET_POSITIONS (${MAX_PLAYABLE_FRET_POSITIONS}) positions → kept`,
      specs: [[0, 2, "C", "chord-root"], [1, 3, "E"], [2, 4, "G"]],
      chord: ["C", "E", "G"],
      expected: 1,
    },
    {
      label: `MAX_PLAYABLE_FRET_POSITIONS + 1 positions → dropped`,
      specs: [[0, 2, "C", "chord-root"], [1, 3, "E"], [2, 5, "G"]],
      chord: ["C", "E", "G"],
      expected: 0,
    },
    {
      label: "UAT-ISSUE-1: Cm7 frets [5,6,8,8] (4 positions) → dropped",
      specs: [[0, 8, "G"], [1, 5, "C", "chord-root"], [2, 8, "A#"], [3, 6, "D#"]],
      chord: ["C", "D#", "G", "A#"],
      expected: 0,
    },
    {
      label: "UAT-ISSUE-2: Cm7 frets [4,5,5,6] (3 positions) → kept",
      specs: [[0, 6, "A#"], [1, 4, "D#"], [2, 5, "C", "chord-root"], [3, 5, "G"]],
      chord: ["C", "D#", "G", "A#"],
      expected: 1,
    },
    {
      label: "all-open strings (no fretted notes) → kept",
      specs: [[0, 0, "C", "chord-root"], [1, 0, "E"]],
      chord: ["C", "E"],
      expected: 1,
    },
    {
      label: "one fretted note (span 0) → kept",
      specs: [[0, 0, "C", "chord-root"], [1, 3, "E"]],
      chord: ["C", "E"],
      expected: 1,
    },
    {
      label: "open string + frets [2,3] (2 fretted positions) → kept",
      specs: [[0, 0, "C", "chord-root"], [1, 2, "E"], [2, 3, "G"]],
      chord: ["C", "E", "G"],
      expected: 1,
    },
    {
      label: "frets [1,5,5] (5 inclusive positions) → dropped",
      specs: [[0, 1, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"]],
      chord: ["C", "E", "G"],
      expected: 0,
    },
  ])("(d) playability: $label", ({ specs, chord, expected }) => {
    expect(build(notes(specs), chord)).toHaveLength(expected);
  });

  it.each<{ label: string; specs: NoteSpec[]; chord: string[]; count: number; verts: number }>([
    {
      label: "(e) repeated shape across 6 strings → 4 voicings (one per N-string window)",
      specs: [[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"],
        [3, 5, "C", "chord-root"], [4, 5, "E"], [5, 5, "G"]],
      chord: ["C", "E", "G"],
      count: 4,
      verts: 3,
    },
    {
      label: "(e) two isolated regions (skipping string 3) → 2 separate voicings",
      specs: [[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"],
        [4, 5, "C", "chord-root"], [5, 5, "E"], [6, 5, "G"]],
      chord: ["C", "E", "G"],
      count: 2,
      verts: 3,
    },
    {
      label: "(f) Cmaj7 on 4-string window → 1 voicing, 4 vertices",
      specs: [[0, 3, "C", "chord-root"], [1, 4, "E"], [2, 3, "G"], [3, 4, "B"]],
      chord: ["C", "E", "G", "B"],
      count: 1,
      verts: 4,
    },
  ])("$label", ({ specs, chord, count, verts }) => {
    const result = build(notes(specs), chord);
    expect(result).toHaveLength(count);
    result.forEach((v) => expect(v.vertices).toHaveLength(verts));
  });

  // -------------------------------------------------------------------------
  // (g) No valid voicing — insufficient strings or non-adjacent string windows
  // -------------------------------------------------------------------------

  it.each<{ label: string; specs: NoteSpec[] }>([
    {
      label: "(g) chord tone missing from candidates (only C,E present, G needed)",
      specs: [[0, 5, "C", "chord-root"], [1, 5, "E"]],
    },
    {
      label: "(g) all 3 tones on only 2 strings → no triad (N=3 needs 3 strings)",
      specs: [[0, 3, "C", "chord-root"], [0, 5, "G"], [1, 4, "E"]],
    },
    {
      label: "non-adjacent strings (skip string 1) → no consecutive-window voicing",
      specs: [[0, 5, "C", "chord-root"], [2, 5, "E"], [3, 5, "G"]],
    },
  ])("$label → empty result", ({ specs }) => {
    expect(build(notes(specs), ["C", "E", "G"])).toHaveLength(0);
  });

  it("deduplicated: same voicing reached via two anchor frets appears only once", () => {
    // C@fret3/string0, E@fret3/string1, G@fret4/string2.
    // Anchor=3 includes all three; anchor=4 excludes C,E (fret 3 < 4) so no dup.
    const result = build(
      notes([[0, 3, "C", "chord-root"], [1, 3, "E"], [2, 4, "G"]]),
      ["C", "E", "G"],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.vertices).toHaveLength(3);
  });

  it("CHORD_TONE_CLASSES contains chord-tone roles and excludes non-chord roles", () => {
    const inSet = ["note-blue", "chord-tone-outside-scale", "chord-tone-in-scale",
      "note-diatonic-chord", "chord-root", "key-tonic"];
    const outSet = ["note-inactive", "note-active", "scale-only"];
    inSet.forEach((role) => expect(CHORD_TONE_CLASSES.has(role)).toBe(true));
    outSet.forEach((role) => expect(CHORD_TONE_CLASSES.has(role)).toBe(false));
  });

  it("non-chord-tone roles on intermediate strings break consecutive-string voicings", () => {
    // String 1 has a note-active D (ignored as a candidate). No consecutive window
    // can include string 1 as a chord-tone vertex → no triad and no 2-tone voicing.
    const specs: NoteSpec[] = [[0, 2, "C", "chord-root"], [1, 4, "D", "note-active"], [2, 6, "E"]];
    expect(build(notes(specs), ["C", "E", "G"])).toHaveLength(0);
    expect(build(notes(specs), ["C", "E"])).toHaveLength(0);
  });

  it("2-tone chord on consecutive strings emits 1 voicing", () => {
    const result = build(notes([[0, 2, "C", "chord-root"], [1, 4, "E"]]), ["C", "E"]);
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

  // CAGED G shape in C major. First polygon (frets 5-8) tightest triad is the
  // E(str1@5)-C(str2@5)-G(str3@5) cluster. Second polygon (frets 17-20) is the
  // octave repeat. Both must be emitted; before the voicing-aware algorithm,
  // dedup occasionally suppressed the fret-5 cluster.
  const cagedGFirstPolygon: NoteSpec[] = [
    [0, 8, "C", "chord-root"],
    [1, 5, "E"], [1, 8, "G"],
    [2, 5, "C", "chord-root"],
    [3, 5, "G"],
    [4, 7, "E"],
    [5, 8, "C", "chord-root"],
  ];
  const cagedGSecondPolygon: NoteSpec[] = cagedGFirstPolygon.map(([si, fi, n, role]) =>
    [si, fi + 12, n, role] as NoteSpec,
  );

  it("(regression) CAGED G shape: emits fret-5 E-C-G voicing on strings 1-2-3", () => {
    const result = build(notes(cagedGFirstPolygon), ["C", "E", "G"]);
    expect(findVoicing(result, [[1, 5], [2, 5], [3, 5]], 3), "fret-5 voicing not emitted").toBeDefined();
  });

  it("(regression) CAGED G shape: emits both fret-5 and fret-17 voicings when both polygon instances present", () => {
    const result = build(notes([...cagedGFirstPolygon, ...cagedGSecondPolygon]), ["C", "E", "G"]);
    const fret5 = findVoicing(result, [[1, 5], [2, 5], [3, 5]], 3);
    const fret17 = findVoicing(result, [[1, 17], [2, 17], [3, 17]], 3);
    expect(fret5, "fret-5 voicing not emitted").toBeDefined();
    expect(fret17, "fret-17 voicing not emitted").toBeDefined();
    expect(fret5).not.toBe(fret17);
  });

  // -------------------------------------------------------------------------
  // Contour smoke tests (fat polyline geometry)
  // Every voicing path: starts with M, ends with Z, fill === outline.
  // Non-collinear voicings dispatch to a rounded tube; collinear voicings
  // dispatch to an inflated capsule. Both produce arc commands ('A').
  // -------------------------------------------------------------------------

  it.each<{ label: string; specs: NoteSpec[]; chord: string[]; arcs: number }>([
    {
      label: "non-collinear triad (3 vertices) → tube with 1 corner + 2 caps",
      specs: [[0, 3, "C", "chord-root"], [1, 5, "E"], [2, 4, "G"]],
      chord: ["C", "E", "G"], arcs: 3,
    },
    {
      label: "non-collinear Cmaj7 (4 vertices) → tube with 2 corners + 2 caps",
      specs: [[0, 3, "C", "chord-root"], [1, 4, "E"], [2, 4, "G"], [3, 5, "B"]],
      chord: ["C", "E", "G", "B"], arcs: 4,
    },
    {
      label: "collinear same-fret triad → capsule (arcs present)",
      specs: [[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"]],
      chord: ["C", "E", "G"], arcs: -1, // capsule path; just assert presence
    },
    {
      label: "(regression) collinear diagonal G-E-C → capsule (arcs present)",
      specs: [[4, 5, "G"], [5, 6, "E"], [6, 7, "C", "chord-root"]],
      chord: ["C", "E", "G"], arcs: -1,
    },
  ])("contour: $label", ({ specs, chord, arcs }) => {
    const result = build(notes(specs), chord);
    expect(result).toHaveLength(1);
    const { paths } = result[0]!;
    expect(paths.fill.startsWith("M")).toBe(true);
    expect(paths.fill.endsWith("Z")).toBe(true);
    expect(paths.fill).toBe(paths.outline);
    expect(paths.fill).toContain("A");
    if (arcs >= 0) {
      const aCount = (paths.fill.match(/\bA\b/g) ?? []).length;
      expect(aCount).toBe(arcs);
    }
  });

  it("(regression) open-string acute triad uses tube geometry, not a triangle hull", () => {
    // Skinny acute voicing: tube has 1 outside arc + 2 end caps = 3 A;
    // a convex-hull offset would emit 3 A but only 3 L (one per hull edge),
    // so an L-count ≥ 4 distinguishes the tube path.
    const result = build(
      notes([[3, 0, "D", "chord-root"], [4, 1, "A#"], [5, 3, "G"]]),
      ["D", "A#", "G"],
    );
    expect(result).toHaveLength(1);
    const { fill } = result[0]!.paths;
    expect((fill.match(/\bA\b/g) ?? []).length).toBe(3);
    expect((fill.match(/\bL\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
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
  // 3NPS Position 2 (C major, frets 10-15). Out-of-position chord tones at
  // str4-f15 and str5-f15 are now note-inactive. The bottom-string in-position
  // voicing (C@str3-f10 / G@str4-f10 / E@str5-f12) must be emitted; the
  // tighter out-of-position one using fret-15 must not.
  const position2Notes = notes([
    [0, 12, "E"], [0, 15, "G"],
    [1, 13, "C", "chord-root"],
    [2, 12, "G"],
    [3, 10, "C", "chord-root"], [3, 14, "E"],
    [4, 10, "G"], [4, 15, "C", "note-inactive"],
    [5, 12, "E"], [5, 15, "G", "note-inactive"],
  ]);

  it("emits the in-position bottom voicing and drops the fret-15 out-of-position voicing", () => {
    const result = build(position2Notes, ["C", "E", "G"]);
    expect(findVoicing(result, [[3, 10], [4, 10], [5, 12]], 3), "in-position bottom voicing not emitted").toBeDefined();
    const outOfPosition = result.find((v) => hasVertex(v.vertices, 4, 15) || hasVertex(v.vertices, 5, 15));
    expect(outOfPosition, "out-of-position voicing must not be emitted").toBeUndefined();
  });
});

describe("paletteIndex field (v2.0 — single accent)", () => {
  it("every voicing carries paletteIndex === 0 (maps to --chord-connector-color-1)", () => {
    const result = build(notes([[0, 0, "C"], [1, 2, "E"], [2, 4, "G"]]), ["C", "E", "G"]);
    expect(result.length).toBeGreaterThan(0);
    for (const v of result) expect(v.paletteIndex).toBe(0);
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
  // Two C-major triads with G in bass — same paletteIndex, different fret positions.
  const voicingA = notes([[0, 1, "C", "chord-root"], [1, 2, "E"], [2, 3, "G"]]);
  const voicingB = notes([[0, 2, "C", "chord-root"], [1, 3, "E"], [2, 4, "G"]]);

  it("(a) same paletteIndex but different canonicalKey → different paths.fill strings", () => {
    const rA = build(voicingA, ["C", "E", "G"]);
    const rB = build(voicingB, ["C", "E", "G"]);
    expect(rA[0]!.paletteIndex).toBe(rB[0]!.paletteIndex);
    expect(rA[0]!.paths.fill).not.toBe(rB[0]!.paths.fill);
  });

  it("(b) same input always produces the same paths.fill string (deterministic)", () => {
    const r1 = build(voicingA, ["C", "E", "G"]);
    const r2 = build(voicingA, ["C", "E", "G"]);
    expect(r1[0]!.paths.fill).toBe(r2[0]!.paths.fill);
  });

  it("(c) adaptive radius factors use compact, medium, and max widths", () => {
    expect(CHORD_CONNECTOR_RADIUS_FACTORS).toEqual({ compact: 0.34, medium: 0.38, max: 0.42 });
  });

  it("(c) uniform base radius regardless of fretted position count; offset adds linearly", () => {
    // Uniform base: 0.42 × 36 = 15.12, above the 11.47 floor.
    expect(computeChordConnectorRadiusPx(STRING_ROW_PX, 0)).toBeCloseTo(15.12);
    expect(computeChordConnectorRadiusPx(STRING_ROW_PX, 0))
      .toBeGreaterThan(chordRootVisualRadiusPx(STRING_ROW_PX));
    const base = computeChordConnectorRadiusPx(STRING_ROW_PX, 0);
    expect(computeChordConnectorRadiusPx(STRING_ROW_PX, 3)).toBeCloseTo(base + 3);
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
    type GeomProps = {
      fretCenterX: (fi: number) => number;
      stringYAt: (si: number, x: number) => number;
    };
    const wide: GeomProps = { fretCenterX: (fi) => fi * 20, stringYAt: (si) => si * 24 };
    const compact: GeomProps = { fretCenterX: (fi) => fi * 10, stringYAt: (si) => si * 18 };

    const { result, rerender } = renderHook(
      (g: GeomProps) =>
        useChordConnectorPolylines({
          noteData: notes([[0, 1, "C", "chord-root"], [1, 2, "E"], [2, 3, "G"]]),
          chordToneNames: ["C", "E", "G"],
          fretCenterX: g.fretCenterX,
          stringYAt: g.stringYAt,
          stringRowPx: STRING_ROW_PX,
        }),
      { initialProps: wide },
    );

    const initialPath = result.current[0]!.paths.fill;
    expect(result.current[0]!.vertices.map((v) => v.x)).toEqual([20, 40, 60]);
    expect(result.current[0]!.vertices.map((v) => v.y)).toEqual([0, 24, 48]);

    rerender(compact);

    expect(result.current[0]!.paths.fill).not.toBe(initialPath);
    expect(result.current[0]!.vertices.map((v) => v.x)).toEqual([10, 20, 30]);
    expect(result.current[0]!.vertices.map((v) => v.y)).toEqual([0, 18, 36]);
  });
});

// -------------------------------------------------------------------------
// Adjacency-aware offset assignment (plan 03-02; updated 2026-05-27)
//
// assignConflictOffsets builds a centerline-conflict graph using polyline
// distances in topology coords, then greedy-colors with OFFSET_BUCKET=[0,3].
// Clusters of 3+ overlapping voicings wrap modulo — the third+ voicing
// reuses an offset, producing a deliberate collision (see OFFSET_BUCKET
// docstring for rationale).
//
// Geometry parameters (used to derive overlap expectations):
//   TOPOLOGY_FRET_UNIT_PX = 16   (calibrated so 3-fret gap = no conflict)
//   TOPOLOGY_STRING_UNIT_PX = 20
//   TOPOLOGY_STRING_ROW_PX = 36
//   baseRadius = 36 * 0.42 ≈ 15.12 px
//   conflict threshold = 2 * baseRadius + CONFLICT_GAP ≈ 31.7 px
//
// Two voicings on the same strings overlap automatically (segments touch).
// "Far apart" = fret distance ≥ 3 frets on same strings (gap ≥ 48 px).
// -------------------------------------------------------------------------

describe("adjacency-aware offset assignment", () => {
  // -------------------------------------------------------------------------
  // Overlapping voicings (sharing strings at the same fret) form a conflict
  // cluster. With OFFSET_BUCKET=[0,3], clusters of size 2 get distinct paths
  // (offsets 0,3); clusters of size 3+ wrap modulo (offsets 0,3,0,…) so the
  // first and third voicings collide — intentional UX trade-off.
  // Non-overlapping voicings stay as singletons with offset 0.
  // -------------------------------------------------------------------------

  const extractRadius = (path: string): number =>
    parseFloat(path.match(/A ([\d.]+)/)?.[1] ?? "0");

  it.each<{ n: number; expectedDistinctRadii: number; specs: NoteSpec[] }>([
    {
      n: 2,
      expectedDistinctRadii: 2,
      specs: [[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"], [3, 5, "C", "chord-root"]],
    },
    {
      n: 3,
      expectedDistinctRadii: 2,
      specs: [[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"],
        [3, 5, "C", "chord-root"], [4, 5, "E"]],
    },
  ])(
    "$n overlapping voicings use ≤2 distinct radii (2-color bucket; cluster of 3+ collides)",
    ({ n, expectedDistinctRadii, specs }) => {
      const result = build(notes(specs), ["C", "E", "G"]);
      expect(result).toHaveLength(n);
      const radii = new Set(result.map((v) => extractRadius(v.paths.fill)));
      expect(radii.size).toBe(expectedDistinctRadii);
    },
  );

  it("non-overlapping voicings get offset 0 (matching singleton baselines)", () => {
    const baseline1 = build(notes([[0, 1, "C", "chord-root"], [1, 2, "E"], [2, 3, "G"]]), ["C", "E", "G"]);
    const baseline2 = build(notes([[0, 9, "C", "chord-root"], [1, 10, "E"], [2, 11, "G"]]), ["C", "E", "G"]);
    const combined = build(
      notes([
        [0, 1, "C", "chord-root"], [1, 2, "E"], [2, 3, "G"],
        [0, 9, "C", "chord-root"], [1, 10, "E"], [2, 11, "G"],
      ]),
      ["C", "E", "G"],
    );
    const v1 = combined.find((v) => v.vertices.some((p) => p.x === fretCenterX(1)));
    const v2 = combined.find((v) => v.vertices.some((p) => p.x === fretCenterX(9)));
    expect(v1!.paths.fill).toBe(baseline1[0]!.paths.fill);
    expect(v2!.paths.fill).toBe(baseline2[0]!.paths.fill);
  });

  it("determinism: same inputs produce identical per-voicing paths across re-runs", () => {
    const noteData = notes([
      [0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"],
      [3, 5, "C", "chord-root"], [4, 5, "E"],
    ]);
    const run1 = build(noteData, ["C", "E", "G"]);
    const run2 = build(noteData, ["C", "E", "G"]);
    expect(run1.length).toBe(run2.length);
    run1.forEach((v, i) => expect(v.paths.fill).toBe(run2[i]!.paths.fill));
  });

  // -------------------------------------------------------------------------
  // Cluster size 6 stress: six overlapping voicings, 2-color bucket caps
  // distinct paths at 2. Offsets alternate 0,3,0,3,0,3 along canonical-key
  // sort order. Intentional collision per OFFSET_BUCKET trade-off.
  // -------------------------------------------------------------------------
  it("cluster of 6 voicings: only 2 distinct radii used (2-color bucket)", () => {
    const result = build(
      notes(["C", "E", "G", "B", "C", "E", "G", "B", "C"].map(
        (n, si) => [si, 5, n, n === "C" ? "chord-root" : "chord-tone-in-scale"] as NoteSpec,
      )),
      ["C", "E", "G", "B"],
    );
    expect(result).toHaveLength(6);
    const radii = new Set(
      result.map((v) => parseFloat(v.paths.fill.match(/A ([\d.]+)/)?.[1] ?? "0")),
    );
    expect(radii.size).toBe(2);
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
  // G/B/D chord-tone positions across all 6 strings, frets 0-22. Root role on G.
  const gMajorChordTones = (): NoteData[] => {
    const POSITIONS: Record<string, ReadonlyArray<readonly [number, number]>> = {
      G: [[0, 3], [0, 15], [1, 8], [1, 20], [2, 0], [2, 12], [3, 5], [3, 17], [4, 10], [4, 22], [5, 3], [5, 15]],
      B: [[0, 7], [0, 19], [1, 0], [1, 12], [2, 4], [2, 16], [3, 9], [3, 21], [4, 2], [4, 14], [5, 7], [5, 19]],
      D: [[0, 10], [0, 22], [1, 3], [1, 15], [2, 7], [2, 19], [3, 0], [3, 12], [4, 5], [4, 17], [5, 10], [5, 22]],
    };
    return Object.entries(POSITIONS).flatMap(([name, positions]) =>
      positions.map(([si, fi]) => makeNote(si, fi, name, name === "G" ? "chord-root" : "chord-tone-in-scale")),
    );
  };

  const voicingsInFretRange = (
    voicings: ReturnType<typeof buildChordConnectorPolylines>,
    minFret: number,
    maxFret: number,
  ) =>
    voicings.filter((v) => {
      const frets = v.voicingKey.split("|").map((p) => Number(p.split(",")[1]));
      return frets.every((f) => f >= minFret && f <= maxFret);
    });

  const expectPositionSharingPairsDiffer = (
    group: ReturnType<typeof buildChordConnectorPolylines>,
    context: string,
  ) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const setA = new Set(group[i]!.voicingKey.split("|"));
        const overlap = group[j]!.voicingKey.split("|").some((pos) => setA.has(pos));
        if (overlap) {
          expect(
            group[i]!.paths.fill,
            `${context}: "${group[i]!.voicingKey}" and "${group[j]!.voicingKey}" share a position but have identical paths`,
          ).not.toBe(group[j]!.paths.fill);
        }
      }
    }
  };

  it("low (frets 7-10) and high (19-22) regions both emit ≥3 voicings of equal count", () => {
    const result = build(gMajorChordTones(), ["G", "B", "D"]);
    const low = voicingsInFretRange(result, 7, 10);
    const high = voicingsInFretRange(result, 19, 22);
    expect(low.length).toBeGreaterThanOrEqual(3);
    expect(high.length).toBeGreaterThanOrEqual(3);
    expect(low.length).toBe(high.length);
  });

  it.each<{ label: string; min: number; max: number; yBounds?: { minY: number; maxY: number } }>([
    { label: "frets 7-10 unbounded", min: 7, max: 10 },
    { label: "frets 19-22 unbounded", min: 19, max: 22 },
    { label: "frets 19-22 with yBounds clamping", min: 19, max: 22, yBounds: { minY: 0, maxY: 100 } },
  ])("$label: overlapping voicings have distinct paths", ({ label, min, max, yBounds }) => {
    const result = build(gMajorChordTones(), ["G", "B", "D"], yBounds);
    expectPositionSharingPairsDiffer(voicingsInFretRange(result, min, max), label);
  });

  it("non-overlapping voicings do not receive conflict-graph inflation (radius near base)", () => {
    const result = build(gMajorChordTones(), ["G", "B", "D"]);
    const base = STRING_ROW_PX * CHORD_CONNECTOR_BASE_RADIUS_FACTOR;
    for (const v of voicingsInFretRange(result, 7, 10)) {
      const rx = parseFloat(v.paths.fill.match(/A ([\d.]+)/)?.[1] ?? "0");
      expect(rx).toBeLessThanOrEqual(base + 15);
    }
  });
});

// -------------------------------------------------------------------------
// voicingKey: stability, uniqueness, and order-independence
// -------------------------------------------------------------------------

describe("voicingKey field", () => {
  const fret5Triad: NoteSpec[] = [[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"]];

  it("stable: same vertex set across calls yields the same voicingKey", () => {
    const r1 = build(notes(fret5Triad), ["C", "E", "G"]);
    const r2 = build(notes(fret5Triad), ["C", "E", "G"]);
    expect(r1[0]!.voicingKey).toBe(r2[0]!.voicingKey);
  });

  it("unique: distinct vertex sets yield different voicingKeys", () => {
    const rA = build(notes(fret5Triad), ["C", "E", "G"]);
    const rB = build(notes([[0, 7, "C", "chord-root"], [1, 7, "E"], [2, 7, "G"]]), ["C", "E", "G"]);
    expect(rA[0]!.voicingKey).not.toBe(rB[0]!.voicingKey);
  });

  it("order-independent: NoteData ordering does not affect voicingKey", () => {
    const forward: NoteSpec[] = [[0, 3, "C", "chord-root"], [1, 5, "E"], [2, 4, "G"]];
    const reverse: NoteSpec[] = [[2, 4, "G"], [1, 5, "E"], [0, 3, "C", "chord-root"]];
    expect(build(notes(forward), ["C", "E", "G"])[0]!.voicingKey)
      .toBe(build(notes(reverse), ["C", "E", "G"])[0]!.voicingKey);
  });

  it("voicingKey is a non-empty string containing the expected coordinate pairs", () => {
    const result = build(
      notes([[0, 5, "C", "chord-root"], [1, 7, "E"], [2, 6, "G"]]),
      ["C", "E", "G"],
    );
    const key = result[0]!.voicingKey;
    expect(key.length).toBeGreaterThan(0);
    // Key must contain each (stringIndex,fretIndex) pair in sorted order joined by "|".
    // Sorted: "0,5" < "1,7" < "2,6" → sorted: "0,5", "1,7", "2,6".
    expect(key).toContain("0,5");
    expect(key).toContain("1,7");
    expect(key).toContain("2,6");
  });

  // -------------------------------------------------------------------------
  // v2.0 — INVERSION_SLOTS / inversionPaletteIndex retired. Every voicing is
  // assigned paletteIndex = 0 (single accent). The v1 inversion-driven palette
  // tests have been removed; the new contract is asserted in the "paletteIndex
  // field (v2.0 — single accent)" describe near the top of the file.
  // -------------------------------------------------------------------------
});

describe("useChordConnectorPolylines v2.0", () => {
  it("does not export INVERSION_SLOTS (drop2/triad inversions retired)", async () => {
    const mod = await import("./useChordConnectorPolylines");
    expect((mod as Record<string, unknown>).INVERSION_SLOTS).toBeUndefined();
    expect((mod as Record<string, unknown>).inversionPaletteIndex).toBeUndefined();
  });
});

describe("useChordConnectorPolylines — voicingSourceActive guard", () => {
  const chordNoteData = notes([[0, 5, "C", "chord-root"], [1, 5, "E"], [2, 5, "G"]]);

  it.each<{ active: boolean; expectEmpty: boolean }>([
    { active: true, expectEmpty: true },
    { active: false, expectEmpty: false },
  ])("voicingSourceActive=$active + empty explicitVoicings → legacy generator gated", ({ active, expectEmpty }) => {
    const { result } = renderHook(() =>
      useChordConnectorPolylines({
        noteData: chordNoteData,
        chordToneNames: ["C", "E", "G"],
        fretCenterX,
        stringYAt,
        stringRowPx: STRING_ROW_PX,
        explicitVoicings: [],
        voicingSourceActive: active,
      }),
    );
    if (expectEmpty) expect(result.current).toEqual([]);
    else expect(result.current.length).toBeGreaterThan(0);
  });
});

describe("connector topology memo split", () => {
  it("builds pending generated voicings without pixel geometry inputs", () => {
    const pending = buildPendingChordConnectorVoicings({
      noteData: notes([
        [0, 5, "C", "chord-root"],
        [1, 5, "E"],
        [2, 5, "G"],
      ]),
      chordToneNames: ["C", "E", "G"],
    });

    expect(pending).toEqual([
      expect.objectContaining({
        canonicalKey: "0,5|1,5|2,5",
        voicingKey: "0,5|1,5|2,5",
        paletteIndex: 0,
        noteCoords: [
          { stringIndex: 0, fretIndex: 5 },
          { stringIndex: 1, fretIndex: 5 },
          { stringIndex: 2, fretIndex: 5 },
        ],
      }),
    ]);
  });

  it("rebuilds pixel vertices when geometry helpers change but preserves voicing identity", () => {
    const noteData = notes([
      [0, 5, "C", "chord-root"],
      [1, 5, "E"],
      [2, 5, "G"],
    ]);
    const firstFretCenterX = (fi: number) => fi * 10;
    const secondFretCenterX = (fi: number) => fi * 20;
    const firstStringYAt = (si: number) => si * 20;
    const secondStringYAt = (si: number) => si * 25;

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
          chordToneNames: ["C", "E", "G"],
          fretCenterX,
          stringYAt,
          stringRowPx: STRING_ROW_PX,
        }),
      {
        initialProps: {
          fretCenterX: firstFretCenterX,
          stringYAt: firstStringYAt,
        },
      },
    );

    expect(result.current[0]?.voicingKey).toBe("0,5|1,5|2,5");
    expect(result.current[0]?.vertices).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 20 },
      { x: 50, y: 40 },
    ]);

    rerender({
      fretCenterX: secondFretCenterX,
      stringYAt: secondStringYAt,
    });

    expect(result.current[0]?.voicingKey).toBe("0,5|1,5|2,5");
    expect(result.current[0]?.vertices).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 25 },
      { x: 100, y: 50 },
    ]);
  });

  it("keeps the pure builder output identical after the refactor", () => {
    const noteData = notes([
      [0, 5, "C", "chord-root"],
      [1, 5, "E"],
      [2, 5, "G"],
    ]);
    const pending = buildPendingChordConnectorVoicings({
      noteData,
      chordToneNames: ["C", "E", "G"],
    });

    const pixel = buildPixelChordConnectorVoicings({
      pendingVoicings: pending,
      fretCenterX,
      stringYAt,
      stringRowPx: STRING_ROW_PX,
    });

    expect(pixel).toEqual(
      buildChordConnectorPolylines(
        noteData,
        ["C", "E", "G"],
        fretCenterX,
        stringYAt,
        STRING_ROW_PX,
      ),
    );
  });
});
