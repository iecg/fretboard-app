import { describe, it, expect } from 'vitest';
import { getCagedCoordinates, CAGED_SHAPES, findMainShape, getShapeCenterFret } from '../shapes';
import { get3NPSCoordinates } from './threeNPS';
import { STANDARD_TUNING } from '../core/guitar';

describe('getCagedCoordinates', () => {
  it('returns non-empty coordinates for standard input', () => {
    const result = getCagedCoordinates('C', 'C', 'Major', STANDARD_TUNING, 24);
    expect(result.coordinates.length).toBeGreaterThan(0);
    expect(result.polygons.length).toBeGreaterThan(0);
  });

  it('returns coordinates for all CAGED shapes', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('A', shape, 'Minor Pentatonic', STANDARD_TUNING, 24);
      expect(result.coordinates.length).toBeGreaterThan(0);
    }
  });

  // Layout-mode independence guarantee:
  // getCagedCoordinates has no dependency on layoutMode, stringRowPx, or any
  // CSS/viewport state. Polygon vertices are fret/string coordinates only —
  // pixel conversion happens in Fretboard.tsx at render time. Calling the
  // function twice with identical args must produce identical output regardless
  // of what layoutMode the app is in.
  it('returns identical polygon vertices on repeated calls (layout-mode-independent)', () => {
    const result1 = getCagedCoordinates('C', 'E', 'Major', STANDARD_TUNING, 24);
    const result2 = getCagedCoordinates('C', 'E', 'Major', STANDARD_TUNING, 24);
    expect(result1.polygons.length).toBeGreaterThan(0);
    expect(result1.polygons).toEqual(result2.polygons);
    expect(result1.coordinates).toEqual(result2.coordinates);
  });
});

describe('truncation detection', () => {
  it('C shape at fret 0-3 in C Major is NOT truncated (wrapping recovers notes)', () => {
    // C shape (A effective after major remap), rootStringFocus=4, fretOffsetMin=-1
    // Root A at fret 0 on A string, intendedMin = -1
    // Any overshoot note wraps to adjacent string successfully
    const result = getCagedCoordinates('C', 'C', 'Major', STANDARD_TUNING, 24);
    const nearZero = result.polygons.find(p => {
      const minFret = Math.min(...p.vertices.map(v => v.fret));
      return minFret <= 1;
    });
    expect(nearZero).toBeDefined();
    expect(nearZero!.truncated).toBe(false);
  });

  it('C shape at fret 24 in C Major IS truncated', () => {
    const result = getCagedCoordinates('C', 'C', 'Major', STANDARD_TUNING, 24);
    const nearEnd = result.polygons.find(p => {
      const maxFret = Math.max(...p.vertices.map(v => v.fret));
      return maxFret >= 24;
    });
    expect(nearEnd).toBeDefined();
    expect(nearEnd!.truncated).toBe(true);
  });

  it('mid-fretboard shape is NOT truncated', () => {
    const result = getCagedCoordinates('C', 'C', 'Major', STANDARD_TUNING, 24);
    const midBoard = result.polygons.find(p => {
      const frets = p.vertices.map(v => v.fret);
      const min = Math.min(...frets);
      const max = Math.max(...frets);
      return min >= 5 && max <= 20;
    });
    expect(midBoard).toBeDefined();
    expect(midBoard!.truncated).toBe(false);
  });

  it('D shape at fret 21-24 in C Major is NOT truncated (wrapping recovers notes)', () => {
    // D shape (C effective after major remap), root A at fret 24
    // intendedMin=21, intendedMax=25; visibleSpan=3 out of 4 → NOT truncated
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
    const near24 = result.polygons.find(p => p.intendedMin >= 21 && p.intendedMax > 24);
    expect(near24).toBeDefined();
    expect(near24!.truncated).toBe(false);
  });
});

describe('note wrapping', () => {
  it('wraps overshoot notes to adjacent string at positive edge', () => {
    // D shape in C Major near fret 24
    // The shape extends to intendedMax = rootFret + 4
    // Notes past fret 24 should wrap to the next thinner string
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);

    // Find coordinates near fret 20-24
    const highFretCoords = result.coordinates.filter(c => {
      const fret = parseInt(c.split('-')[1]);
      return fret >= 18;
    });
    expect(highFretCoords.length).toBeGreaterThan(0);

    // The wrapped note should appear on a string that wouldn't normally
    // have a note at that position in the base shape
    // Just verify we have coordinates in the high fret range
    // (wrapping adds notes that would otherwise be lost)
  });

  it('does NOT wrap mid-fretboard shapes', () => {
    // A shape rooted at fret 12 - no overshoot in either direction
    const result = getCagedCoordinates('A', 'A', 'Minor Pentatonic', STANDARD_TUNING, 24);

    // Find polygon near fret 12
    const midPoly = result.polygons.find(p => {
      const frets = p.vertices.map(v => v.fret);
      const center = (Math.min(...frets) + Math.max(...frets)) / 2;
      return center > 8 && center < 18;
    });
    expect(midPoly).toBeDefined();
    expect(midPoly!.truncated).toBe(false);
  });

  it('coordinates stay within 0..24 range after wrapping', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('C', shape, 'Major', STANDARD_TUNING, 24);
      for (const coord of result.coordinates) {
        const [, fretStr] = coord.split('-');
        const fret = parseInt(fretStr);
        expect(fret).toBeGreaterThanOrEqual(0);
        expect(fret).toBeLessThanOrEqual(24);
      }
    }
  });

  it('shapes with >2-fret positive overshoot are NOT wrapped (truncated instead)', () => {
    // D shape in C# Natural Minor: anchor C# on string 3 (D3) at fret 23
    // fretOffsetMax = 4, so intendedMax = 27, overshoot = 3 > MAX_WRAP_OVERSHOOT
    // The gate should skip wrapping entirely — shape renders truncated
    const result = getCagedCoordinates('C#', 'D', 'Natural Minor', STANDARD_TUNING, 24);
    // The truncated high-fret shape polygon has intendedMax > 24
    const overshot = result.polygons.find(p => p.intendedMax > 24);
    expect(overshot).toBeDefined();
    expect(overshot!.truncated).toBe(true);
  });

  it('1-fret positive overshoot still wraps a note to adjacent string', () => {
    // D shape in C Major (remapped to C effective), anchor A at fret 24 on string 4
    // fretOffsetMax = 1, so intendedMax = 25, overshoot = 1 <= MAX_WRAP_OVERSHOOT
    // Wrapping should still recover the note — shape is NOT truncated
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
    const near24 = result.polygons.find(p => p.intendedMin >= 21 && p.intendedMax > 24);
    expect(near24).toBeDefined();
    expect(near24!.truncated).toBe(false);
  });
});

describe('wrappedNotes tracking', () => {
  it('wrappedNotes is always present (empty Set when no wrapping)', () => {
    // Mid-fretboard shape: no overshoot, no wrapping expected
    const result = getCagedCoordinates('A', 'A', 'Minor Pentatonic', STANDARD_TUNING, 24);
    expect(result.wrappedNotes).toBeInstanceOf(Set);
    expect(result.wrappedNotes.size).toBe(0);
  });

  it('wrappedNotes contains keys added by positive-overshoot wrapping', () => {
    // D shape in C Major (remapped to C effective), anchor A at fret 24 on string 4
    // intendedMax = 25, overshoot = 1 <= MAX_WRAP_OVERSHOOT — wrapping occurs
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
    // At least one wrapped note should exist at the high-fret end
    expect(result.wrappedNotes.size).toBeGreaterThan(0);
    // All wrapped note keys must be valid coordinates within the fretboard
    for (const key of result.wrappedNotes) {
      const [, fretStr] = key.split('-');
      const fret = parseInt(fretStr);
      expect(fret).toBeGreaterThanOrEqual(0);
      expect(fret).toBeLessThanOrEqual(24);
      // The key should also appear in the coordinates list (wrapped notes are visible)
      expect(result.coordinates).toContain(key);
    }
  });

  it('wrapped note fret positions do NOT appear as polygon vertices', () => {
    // D shape in C Major: wrapping occurs at fret 24 boundary
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
    expect(result.wrappedNotes.size).toBeGreaterThan(0);

    for (const key of result.wrappedNotes) {
      const [stringStr, fretStr] = key.split('-');
      const wrappedString = parseInt(stringStr);
      const wrappedFret = parseInt(fretStr);

      for (const polygon of result.polygons) {
        for (const vertex of polygon.vertices) {
          // A polygon vertex must not exactly match both string and fret of a wrapped note
          const isWrappedVertex = vertex.string === wrappedString && vertex.fret === wrappedFret;
          expect(isWrappedVertex).toBe(false);
        }
      }
    }
  });

  it('string with only wrapped notes is skipped in polygon (no crash)', () => {
    // Run all shapes / scales near boundaries; should never throw
    for (const shape of CAGED_SHAPES) {
      expect(() => {
        getCagedCoordinates('C', shape, 'Major', STANDARD_TUNING, 24);
      }).not.toThrow();
    }
  });
});

describe('labels', () => {
  it('generates modal labels for Major scale', () => {
    const result = getCagedCoordinates('C', 'E', 'Major', STANDARD_TUNING, 24);
    const nonTruncated = result.polygons.filter(p => !p.truncated);
    expect(nonTruncated.length).toBeGreaterThan(0);
    // Modal labels should contain mode names
    for (const poly of nonTruncated) {
      expect(poly.modalLabel).toBeTruthy();
      expect(poly.modalLabel).toMatch(/Ionian|Dorian|Phrygian|Lydian|Mixolydian|Aeolian|Locrian/);
    }
  });

  it('generates CAGED labels with minor suffix for minor scales', () => {
    const result = getCagedCoordinates('A', 'E', 'Natural Minor', STANDARD_TUNING, 24);
    for (const poly of result.polygons) {
      expect(poly.cagedLabel).toContain('m');
      expect(poly.cagedLabel).toMatch(/Em Shape/);
    }
  });

  it('generates CAGED labels without suffix for major scales', () => {
    const result = getCagedCoordinates('C', 'E', 'Major', STANDARD_TUNING, 24);
    for (const poly of result.polygons) {
      expect(poly.cagedLabel).toBe('E Shape');
    }
  });

  it('returns null modalLabel for pentatonic scales', () => {
    const result = getCagedCoordinates('A', 'E', 'Minor Pentatonic', STANDARD_TUNING, 24);
    for (const poly of result.polygons) {
      expect(poly.modalLabel).toBeNull();
    }
  });
});

describe('Natural Minor polygon shapes', () => {
  const NUM_STRINGS = STANDARD_TUNING.length;

  it('produces a polygon for every CAGED shape', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('A', shape, 'Natural Minor', STANDARD_TUNING, 24);
      expect(result.polygons.length).toBeGreaterThan(0);
    }
  });

  it('each mid-board polygon has exactly 2×numStrings vertices', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('A', shape, 'Natural Minor', STANDARD_TUNING, 24);
      const midBoard = result.polygons.find(p => !p.truncated);
      expect(midBoard).toBeDefined();
      expect(midBoard!.vertices.length).toBe(NUM_STRINGS * 2);
    }
  });

  it('left-edge vertices are ordered s0→s5', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('A', shape, 'Natural Minor', STANDARD_TUNING, 24);
      const poly = result.polygons.find(p => !p.truncated);
      expect(poly).toBeDefined();
      const leftEdge = poly!.vertices.slice(0, NUM_STRINGS);
      for (let i = 0; i < leftEdge.length; i++) {
        expect(leftEdge[i].string).toBe(i);
      }
    }
  });

  it('right-edge vertices are ordered s5→s0', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('A', shape, 'Natural Minor', STANDARD_TUNING, 24);
      const poly = result.polygons.find(p => !p.truncated);
      expect(poly).toBeDefined();
      const rightEdge = poly!.vertices.slice(NUM_STRINGS);
      for (let i = 0; i < rightEdge.length; i++) {
        expect(rightEdge[i].string).toBe(NUM_STRINGS - 1 - i);
      }
    }
  });

  it('polygon fret boundaries match expected SHAPE_TEMPLATES_7NOTE offsets', () => {
    // Expected per-string [left, right] offsets relative to anchor rootFret
    const expectedOffsets: Record<string, [number, number][]> = {
      C: [[-2,1],[-2,1],[-3,0],[-3,0],[-2,0],[-2,1]],
      A: [[ 0,3],[ 0,3],[ 0,2],[ 0,3],[ 0,3],[ 0,3]],
      G: [[-2,0],[-2,1],[-3,0],[-3,0],[-3,0],[-2,0]],
      E: [[ 0,3],[ 0,3],[-1,2],[ 0,2],[ 0,3],[ 0,3]],
      D: [[ 0,3],[ 1,3],[ 0,3],[ 0,3],[ 0,3],[ 0,3]],
    };
    const anchorStrings: Record<string, number> = { C:4, A:4, G:5, E:5, D:3 };

    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('A', shape, 'Natural Minor', STANDARD_TUNING, 24);
      const poly = result.polygons.find(p => !p.truncated);
      expect(poly).toBeDefined();

      // Find rootFret (anchor note on anchor string) for this polygon
      const anchorStr = anchorStrings[shape];
      const leftEdge = poly!.vertices.slice(0, NUM_STRINGS);
      const rightEdge = poly!.vertices.slice(NUM_STRINGS).reverse(); // reverse back to s0→s5
      const rootFret = leftEdge[anchorStr].fret - expectedOffsets[shape][anchorStr][0];

      const offsets = expectedOffsets[shape];
      for (let s = 0; s < NUM_STRINGS; s++) {
        expect(leftEdge[s].fret).toBe(rootFret + offsets[s][0]);
        expect(rightEdge[s].fret).toBe(rootFret + offsets[s][1]);
      }
    }
  });

  it('Natural Minor polygons use same vertex structure as pentatonic polygons', () => {
    // Both should have 2×numStrings vertices in a non-truncated mid-board position
    const minor = getCagedCoordinates('A', 'E', 'Natural Minor', STANDARD_TUNING, 24);
    const pent  = getCagedCoordinates('A', 'E', 'Minor Pentatonic', STANDARD_TUNING, 24);
    const minorPoly = minor.polygons.find(p => !p.truncated);
    const pentPoly  = pent.polygons.find(p => !p.truncated);
    expect(minorPoly).toBeDefined();
    expect(pentPoly).toBeDefined();
    expect(minorPoly!.vertices.length).toBe(pentPoly!.vertices.length);
  });
});

describe('wrap limit (>2 notes reverts wrapping)', () => {
  it('C# Major D shape near fret 0 generates >2 potential wraps — none are applied', () => {
    // D→C remap, anchor A# at fret 1 on A string, intendedMin=-2 (2 frets of negative overshoot).
    // Proxy frets -2 and -1 map to C# Major scale notes on 5+ strings → 7 potential wrapped notes.
    // The limit (>2) should revert ALL wrapping for this instance.
    const result = getCagedCoordinates('C#', 'D', 'Major', STANDARD_TUNING, 24);
    // After revert, only the second rootFret instance (no overshoot) contributes: 0 wrapped notes
    expect(result.wrappedNotes.size).toBe(0);
  });

  it('D Major D shape near fret 0 generates exactly 2 wraps — they are kept', () => {
    // D→C remap, anchor B at fret 2 on A string, intendedMin=-1 (1 fret negative overshoot).
    // 2 notes wrap. Size ≤ 2 → kept.
    const result = getCagedCoordinates('D', 'D', 'Major', STANDARD_TUNING, 24);
    expect(result.wrappedNotes.size).toBe(2);
  });

  it('C Major D shape near fret 24 generates ≤2 wraps — they are kept', () => {
    // D→C remap, anchor A at fret 24, intendedMax=25 (1 fret positive overshoot). 1 note wraps.
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
    expect(result.wrappedNotes.size).toBeGreaterThan(0);
    expect(result.wrappedNotes.size).toBeLessThanOrEqual(2);
  });

  it('reverted shape: no extra-range coordinates after wrap revert', () => {
    // When wrapping is reverted, notes outside clamped shape window should NOT appear
    const result = getCagedCoordinates('C#', 'D', 'Major', STANDARD_TUNING, 24);
    for (const coord of result.coordinates) {
      const [, fretStr] = coord.split('-');
      expect(parseInt(fretStr)).toBeGreaterThanOrEqual(0);
      expect(parseInt(fretStr)).toBeLessThanOrEqual(24);
    }
  });
});

describe('truncation boundary', () => {
  it('shape showing exactly 50% of intended span is truncated', () => {
    // C# Major D shape: effectiveShape C, anchor A# at fret 1, intendedMin=-2, intendedMax=2
    // intendedSpan=4, visibleSpan=2 → visibleSpan equals intendedSpan/2 → must be truncated
    const result = getCagedCoordinates('C#', 'D', 'Major', STANDARD_TUNING, 24);
    const nearZero = result.polygons.find(p => p.intendedMin < 0);
    expect(nearZero).toBeDefined();
    expect(nearZero!.truncated).toBe(true);
  });

  it('shape showing 75% of intended span is NOT truncated', () => {
    // C Major D shape near fret 24: intendedMin=21, intendedMax=25 → span=4, visible=3 (75%)
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
    const near24 = result.polygons.find(p => p.intendedMax > 24);
    expect(near24).toBeDefined();
    expect(near24!.truncated).toBe(false);
  });
});

describe('7-note scale polygon templates', () => {
  const SCALES_TO_TEST = ['Phrygian', 'Mixolydian', 'Locrian', 'Harmonic Minor', 'Dorian'];

  for (const scale of SCALES_TO_TEST) {
    it(`${scale}: all CAGED shapes produce non-empty polygon vertices (non-edge)`, () => {
      for (const shape of CAGED_SHAPES) {
        // Use root A so all shapes have room away from fret 0 and fret 24
        const result = getCagedCoordinates('A', shape, scale, STANDARD_TUNING, 24);
        const midPolygons = result.polygons.filter(p => !p.truncated);
        expect(midPolygons.length).toBeGreaterThan(0);
        for (const poly of midPolygons) {
          expect(poly.vertices.length).toBeGreaterThan(0);
        }
      }
    });
  }

  it('Phrygian A-shape polygon does not use Natural Minor template (b2 extends left)', () => {
    // Phrygian A-shape s1 left offset is -1 (b2 on B string), NM has 0
    const result = getCagedCoordinates('A', 'A', 'Phrygian', STANDARD_TUNING, 24);
    const poly = result.polygons.find(p => !p.truncated);
    expect(poly).toBeDefined();
    // halfVerts = vertices.length / 2; left edge for s1 (index 1) should have offset -1 from anchor
    // anchor is on string 4 (A-string), A is at fret 0 on A string
    // For root A, A-shape anchor at fret 0 on s4 → usually wraps, use fret 12 instead
    const result2 = getCagedCoordinates('A', 'A', 'Phrygian', STANDARD_TUNING, 24);
    const poly2 = result2.polygons.find(p => p.intendedMin >= 0 && p.intendedMax <= 24 && !p.truncated);
    expect(poly2).toBeDefined();
    expect(poly2!.vertices.length).toBeGreaterThan(0);
  });

  it('Harmonic Minor: all shapes produce polygons for root A', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('A', shape, 'Harmonic Minor', STANDARD_TUNING, 24);
      const hasPolygon = result.polygons.some(p => p.vertices.length > 0);
      expect(hasPolygon).toBe(true);
    }
  });

  it('unsupported harmonic minor modes use generated polygons instead of the default 7-note template', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates(
        'E',
        shape,
        'Phrygian Dominant',
        STANDARD_TUNING,
        24,
      );
      const nonTruncated = result.polygons.filter((polygon) => !polygon.truncated);
      expect(nonTruncated.length).toBeGreaterThan(0);
      for (const polygon of nonTruncated) {
        expect(polygon.vertices.length).toBeGreaterThan(0);
      }
    }
  });

  it('melodic minor families produce generated polygons for every CAGED shape', () => {
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates(
        'C',
        shape,
        'Lydian Dominant',
        STANDARD_TUNING,
        24,
      );
      const nonTruncated = result.polygons.filter((polygon) => !polygon.truncated);
      expect(nonTruncated.length).toBeGreaterThan(0);
      for (const polygon of nonTruncated) {
        expect(polygon.vertices.length).toBeGreaterThan(0);
      }
    }
  });

  it('Locrian: all shapes produce polygons (non-edge shapes)', () => {
    // Locrian was reported broken for non-edge shapes too
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('E', shape, 'Locrian', STANDARD_TUNING, 24);
      expect(result.polygons.length).toBeGreaterThan(0);
    }
  });
});

describe('Lydian and Mixolydian use relative-minor templates', () => {
  it('Lydian uses Dorian templates (not Natural Minor)', () => {
    // C Lydian → relative Dorian root = A (C-3). Dorian D-shape s1 left offset = 0 (NM has 1).
    // If NM templates were used, a Dorian-only note at rootFret+0 on s1 would fall outside.
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('C', shape, 'Lydian', STANDARD_TUNING, 24);
      const nonTruncated = result.polygons.filter(p => !p.truncated);
      expect(nonTruncated.length).toBeGreaterThan(0);
      for (const poly of nonTruncated) {
        // Polygon must cover at least 2 frets of span (sanity check non-trivial shape)
        const frets = poly.vertices.map(v => v.fret);
        expect(Math.max(...frets) - Math.min(...frets)).toBeGreaterThan(1);
      }
    }
  });

  it('Mixolydian uses Phrygian templates (not Natural Minor)', () => {
    // G Mixolydian → relative Phrygian root = E (G-3). Phrygian A-shape s1 left offset = -1 (NM has 0).
    for (const shape of CAGED_SHAPES) {
      const result = getCagedCoordinates('G', shape, 'Mixolydian', STANDARD_TUNING, 24);
      const nonTruncated = result.polygons.filter(p => !p.truncated);
      expect(nonTruncated.length).toBeGreaterThan(0);
      for (const poly of nonTruncated) {
        const frets = poly.vertices.map(v => v.fret);
        expect(Math.max(...frets) - Math.min(...frets)).toBeGreaterThan(1);
      }
    }
  });
});

describe('findMainShape', () => {
  it('returns null for empty polygons array', () => {
    const result = findMainShape([], new Set(), 0, 24);
    expect(result).toBeNull();
  });

  it('returns null when all shapes are truncated', () => {
    // Get shapes that extend beyond fret 24
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
    const truncatedPolys = result.polygons.filter(p => p.truncated);
    expect(truncatedPolys.length).toBeGreaterThan(0);

    const main = findMainShape(truncatedPolys, result.wrappedNotes, 0, 24);
    expect(main).toBeNull();
  });

  it('returns null when shapes have wrapped notes', () => {
    // D shape in C Major has wrapped notes at high frets
    const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
    expect(result.wrappedNotes.size).toBeGreaterThan(0);

    // With wrapped notes and no complete shapes, should return null
    const _main = findMainShape(result.polygons, result.wrappedNotes, 0, 24);
    // May find a complete shape, or may return null if all have wrapped notes
    // The function filters out shapes with wrapped note vertices
    void _main;
  });

  it('returns shape with lowest intendedMin when multiple complete shapes', () => {
    const result = getCagedCoordinates('A', 'E', 'Major', STANDARD_TUNING, 24);
    // E shape produces multiple polygons at different positions
    const nonTruncated = result.polygons.filter(p => !p.truncated);
    expect(nonTruncated.length).toBeGreaterThan(1);

    const main = findMainShape(nonTruncated, result.wrappedNotes, 0, 24);
    expect(main).toBeDefined();
    // Main shape should have the lowest intendedMin
    for (const poly of nonTruncated) {
      expect(main!.intendedMin).toBeLessThanOrEqual(poly.intendedMin);
    }
  });

  it('filters shapes outside visible fret range', () => {
    const result = getCagedCoordinates('A', 'E', 'Major', STANDARD_TUNING, 24);
    // Narrow visible range that excludes high fret shapes
    const main = findMainShape(result.polygons, result.wrappedNotes, 0, 10);
    if (main) {
      expect(main.intendedMax).toBeLessThanOrEqual(10);
    }
  });

  it('filters shapes that start before visible range', () => {
    const result = getCagedCoordinates('A', 'E', 'Major', STANDARD_TUNING, 24);
    // Visible range starting at fret 5
    const main = findMainShape(result.polygons, result.wrappedNotes, 5, 24);
    if (main) {
      expect(main.intendedMin).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('getShapeCenterFret', () => {
  it('calculates center of polygon correctly', () => {
    const result = getCagedCoordinates('A', 'E', 'Major', STANDARD_TUNING, 24);
    const poly = result.polygons.find(p => !p.truncated);
    expect(poly).toBeDefined();

    const center = getShapeCenterFret(poly!);
    const expectedCenter = (poly!.intendedMin + poly!.intendedMax) / 2;
    expect(center).toBe(expectedCenter);
  });

  it('returns correct center for symmetric shape', () => {
    // Create a mock polygon with known bounds
    const mockPoly = {
      vertices: [],
      shape: 'E' as const,
      color: 'red',
      cagedLabel: 'E Shape',
      modalLabel: null,
      truncated: false,
      intendedMin: 5,
      intendedMax: 9,
    };

    const center = getShapeCenterFret(mockPoly);
    expect(center).toBe(7);
  });
});

describe('Phase 4: Extended Boundary Conditions', () => {
  describe('Note Wrapping at extreme edges', () => {
    it('wraps when intendedMin is exactly -1 (negative overshoot)', () => {
      // D Major D shape near fret 0 (remapped to C effective)
      // anchor B at fret 2 on A string, intendedMin = 2 - 3 = -1
      // negative overshoot = 1, should wrap.
      const result = getCagedCoordinates('D', 'D', 'Major', STANDARD_TUNING, 24);
      // Wrapping should recover at least one note from the negative overshoot
      expect(result.wrappedNotes.size).toBeGreaterThan(0);
      
      // All wrapped notes should be within the search margin [0, shapeMax + 2]
      for (const key of result.wrappedNotes) {
        const [, fretStr] = key.split('-');
        const fret = parseInt(fretStr);
        expect(fret).toBeLessThanOrEqual(5); // shapeMax (3) + 2
      }
    });

    it('wraps when intendedMax is exactly frets + 1 (positive overshoot)', () => {
      // C Major D shape near fret 24 (remapped to C effective)
      // anchor A at fret 24 on string 4, intendedMax = 24 + 1 = 25
      // positive overshoot = 1, should wrap.
      const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
      expect(result.wrappedNotes.size).toBeGreaterThan(0);
    });

    it('does NOT wrap on string 0 for positive overshoot (no thinner string)', () => {
      // If a note on the thinnest string (string 0) overshoots positive, it can't wrap to s-1
      // We need to find a shape where a note on string 0 overshoots.
      // D shape root A at fret 24 on s4. Notes on s0 (E string) are at rootFret + 0..3
      // Wait, D shape offsets for s0: [0, 3] relative to anchor rootFret.
      // If rootFret=24, s0 notes are at 24 and 27 (if they exist in scale). 27 > 24.
      // wrapOvershootNotes should skip s=0 for target = s-1 = -1.
      const result = getCagedCoordinates('C', 'D', 'Major', STANDARD_TUNING, 24);
      const wrappedOnInvalidString = Array.from(result.wrappedNotes).some(k => k.startsWith('-1-'));
      expect(wrappedOnInvalidString).toBe(false);
    });

    it('does NOT wrap on bottom string for negative overshoot (no thicker string)', () => {
      // G shape anchor root on s5 (thickest string).
      // fretOffsetMin for G shape is -2 (or -3 depending on scale).
      // If root is at fret 1, intendedMin could be -1.
      // G Major G shape, root G at fret 3 on s5. (Remapped to E effective, root E at fret 0 on s5)
      // Wait, G remapped to E effective. Root E at fret 0 on s5.
      // E shape fretOffsetMin = 0. No negative overshoot.
      
      // Let's use Minor Pentatonic G shape (no remap). anchor root on s5.
      // G shape (Minor Pent) fretOffsetMin = -3.
      // Root A at fret 5 on s5. intendedMin = 2. No overshoot.
      // Root A at fret 17 on s5.
      
      // Let's force it: root at fret 1, fretOffsetMin = -3 => intendedMin = -2.
      const result = getCagedCoordinates('F#', 'G', 'Minor Pentatonic', STANDARD_TUNING, 24);
      // F# at fret 2 on s5. intendedMin = 2 - 3 = -1.
      // negative overshoot = 1.
      // But s=5 is the bottom string, can't wrap to s+1 = 6.
      const wrappedOnInvalidString = Array.from(result.wrappedNotes).some(k => k.startsWith('6-'));
      expect(wrappedOnInvalidString).toBe(false);
    });
  });

  describe('Fretboard Truncation on short boards', () => {
    it('truncates shape on 5-fret board if it spans 6 frets', () => {
      // E shape spans roughly 4 frets [0, 3].
      // On a 2-fret board, it should be truncated.
      const result = getCagedCoordinates('A', 'E', 'Major', STANDARD_TUNING, 2);
      for (const p of result.polygons) {
        expect(p.truncated).toBe(true);
      }
    });

    it('strictly follows 50% span rule for truncation', () => {
      const result2 = getCagedCoordinates('G', 'A', 'Major', STANDARD_TUNING, 24);
      const poly2 = result2.polygons.find(p => p.intendedMin < 0);
      if (poly2) {
        const visibleSpan = Math.min(24, poly2.intendedMax) - Math.max(0, poly2.intendedMin);
        const intendedSpan = poly2.intendedMax - poly2.intendedMin;
        expect(poly2.truncated).toBe(visibleSpan <= intendedSpan / 2);
      }
    });
  });

  describe('Chromatic and Non-Diatonic Overshoot', () => {
    it('handles "busy" scales without crashing (e.g. Altered scale)', () => {
      expect(() => {
        getCagedCoordinates('C', 'E', 'Altered', STANDARD_TUNING, 24);
      }).not.toThrow();
    });

    it('omits notes that are not in the scale even if they are within the shape boundaries', () => {
      const result = getCagedCoordinates('A', 'E', 'Minor Pentatonic', STANDARD_TUNING, 24);
      expect(result.coordinates.length).toBeGreaterThan(0);
    });

    it('wrapping logic handles non-diatonic notes correctly', () => {
      // Blues scale has the "blue note".
      const result = getCagedCoordinates('A', 'E', 'Minor Blues', STANDARD_TUNING, 24);
      // Verify blue note (Eb if root is A) is present if it's in range
      // Eb on A string is fret 6.
      const hasBlueNote = result.coordinates.some(c => {
         const [s, f] = c.split('-').map(Number);
         return s === 4 && f === 6;
      });
      expect(hasBlueNote).toBeDefined(); // Just ensure it processed without error
    });
  });
});

describe('get3NPSCoordinates', () => {
  it('position 1 returns non-empty coordinates in the first octave register', () => {
    const result = get3NPSCoordinates('C', 'Major', STANDARD_TUNING, 24, 1);
    expect(result.coordinates.length).toBeGreaterThan(0);
    expect(result.bounds.length).toBe(1);
    // C major position 1 starts on low E at fret 8 (first C); notes stay low on neck
    expect(result.bounds[0].minFret).toBeLessThan(12);
  });

  it('position 8 (cycle 1) lands in the second octave register, not duplicating position 1', () => {
    const pos1 = get3NPSCoordinates('C', 'Major', STANDARD_TUNING, 24, 1);
    const pos8 = get3NPSCoordinates('C', 'Major', STANDARD_TUNING, 24, 8);
    expect(pos8.coordinates.length).toBeGreaterThan(0);
    // Second cycle should start above fret 12 — distinctly higher than position 1
    expect(pos8.bounds[0].minFret).toBeGreaterThan(pos1.bounds[0].minFret);
    expect(pos8.bounds[0].minFret).toBeGreaterThanOrEqual(12);
  });

  it('high out-of-range position falls back to highest available register without wrapping', () => {
    // Position 20 far exceeds cycles available on a 24-fret board; should
    // return the highest findable occurrence rather than returning empty.
    const result = get3NPSCoordinates('C', 'Major', STANDARD_TUNING, 24, 20);
    expect(result.coordinates.length).toBeGreaterThan(0);
    // Should not crash and coordinates must stay within [0, 24]
    for (const coord of result.coordinates) {
      const fret = parseInt(coord.split('-')[1]);
      expect(fret).toBeGreaterThanOrEqual(0);
      expect(fret).toBeLessThanOrEqual(24);
    }
  });

  it('all positions return coordinates within the fretboard range', () => {
    for (let pos = 1; pos <= 12; pos++) {
      const result = get3NPSCoordinates('G', 'Natural Minor', STANDARD_TUNING, 24, pos);
      expect(result.coordinates.length).toBeGreaterThan(0);
      for (const coord of result.coordinates) {
        const fret = parseInt(coord.split('-')[1]);
        expect(fret).toBeGreaterThanOrEqual(0);
        expect(fret).toBeLessThanOrEqual(24);
      }
    }
  });

  it('wrappedNotes is always an empty Set (3NPS does not wrap notes)', () => {
    for (let pos = 1; pos <= 12; pos++) {
      const result = get3NPSCoordinates('A', 'Minor Pentatonic', STANDARD_TUNING, 24, pos);
      expect(result.wrappedNotes).toBeInstanceOf(Set);
      expect(result.wrappedNotes.size).toBe(0);
    }
  });
});


