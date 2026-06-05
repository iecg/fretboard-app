import { describe, it, expect } from 'vitest';
import {
  getAdjacentDegree,
  getDegreesForScale,
  getDegreeSequence,
  getQualityForDegree,
  remapDegreeForScale,
  _validateDiatonicQualitiesAgainstTonal,
} from './degrees';
import { SCALES } from './theoryCatalog';
import * as RomanNumeral from '@tonaljs/roman-numeral';

describe('getDegreesForScale', () => {
  describe('Major modes', () => {
    it('returns Major degrees for Major scale', () => {
      const degrees = getDegreesForScale('major');
      expect(degrees).toEqual({
        0: 'I',
        2: 'ii',
        4: 'iii',
        5: 'IV',
        7: 'V',
        9: 'vi',
        11: 'vii°',
      });
    });

    it('returns Lydian degrees for Lydian scale', () => {
      const degrees = getDegreesForScale('lydian');
      expect(degrees[6]).toBe('iv°'); // Raised 4th as diminished interval
      expect(degrees[0]).toBe('I');
      expect(degrees[7]).toBe('V');
    });

    it('returns Mixolydian degrees for Mixolydian scale', () => {
      const degrees = getDegreesForScale('mixolydian');
      expect(degrees[10]).toBe('VII'); // Lowered 7th
      expect(degrees[0]).toBe('I');
      expect(degrees[7]).toBe('v'); // Lowered 5th
    });
  });

  describe('Minor modes', () => {
    it('returns Natural Minor degrees for Natural Minor scale', () => {
      const degrees = getDegreesForScale('minor');
      expect(degrees).toEqual({
        0: 'i',
        2: 'ii°',
        3: 'III',
        5: 'iv',
        7: 'v',
        8: 'VI',
        10: 'VII',
      });
    });

    it('returns Dorian degrees for Dorian scale', () => {
      const degrees = getDegreesForScale('dorian');
      expect(degrees[0]).toBe('i');
      expect(degrees[2]).toBe('ii'); // Major 2nd (vs Natural Minor)
      expect(degrees[9]).toBe('vi°'); // Diminished 6th
    });

    it('returns Phrygian degrees for Phrygian scale', () => {
      const degrees = getDegreesForScale('phrygian');
      expect(degrees[0]).toBe('i');
      expect(degrees[1]).toBe('II'); // Major 2nd (characteristic)
      expect(degrees[7]).toBe('v°'); // Diminished 5th
    });

    it('returns Locrian degrees for Locrian scale', () => {
      const degrees = getDegreesForScale('locrian');
      expect(degrees[0]).toBe('i°'); // Diminished root
      expect(degrees[1]).toBe('II');
      expect(degrees[6]).toBe('V'); // Major 5th
    });

    it('returns Harmonic Minor degrees for Harmonic Minor scale', () => {
      const degrees = getDegreesForScale('harmonic minor');
      expect(degrees[0]).toBe('i');
      expect(degrees[3]).toBe('III+'); // Augmented (raised 3rd)
      expect(degrees[7]).toBe('V'); // Major 5th (vs natural minor)
      expect(degrees[11]).toBe('vii°'); // Diminished 7th
    });

    it("computes Melodic Minor degrees from diatonic-triad intervals", () => {
      // Melodic Minor [0,2,3,5,7,9,11]:
      //   i (minor) — ii (minor) — III+ (aug) — IV (major) — V (major) — vi° (dim) — vii° (dim)
      const degrees = getDegreesForScale("melodic minor");
      expect(degrees).toEqual({
        0: "i",
        2: "ii",
        3: "III+",
        5: "IV",
        7: "V",
        9: "vi°",
        11: "vii°",
      });
    });

    it("computes Phrygian Dominant (Harmonic Minor 5th mode) degrees correctly", () => {
      // Phrygian Dominant [0,1,4,5,7,8,10] — flamenco / Spanish Phrygian:
      //   I (major) — II (major) — iii° (dim) — iv (minor) — v° (dim) — VI+ (aug) — vii (minor)
      const degrees = getDegreesForScale("phrygian dominant");
      expect(degrees).toEqual({
        0: "I",
        1: "II",
        4: "iii°",
        5: "iv",
        7: "v°",
        8: "VI+",
        10: "vii",
      });
    });

    it("computes Lydian Augmented (Melodic Minor 3rd mode) degrees correctly", () => {
      // Lydian Augmented [0,2,4,6,8,9,11]:
      //   I+ (aug) — II (major) — III (major) — #iv° (dim) — v° (dim) — vi (minor) — vii (minor)
      const degrees = getDegreesForScale("lydian augmented");
      expect(degrees).toEqual({
        0: "I+",
        2: "II",
        4: "III",
        6: "iv°",
        8: "v°",
        9: "vi",
        11: "vii",
      });
    });
  });

  describe('Fallback behavior', () => {
    it('returns Natural Minor degrees for unknown scale', () => {
      const degrees = getDegreesForScale('Unknown Major-like');
      // Unknown scales are not in SCALES, so intervals is undefined;
      // the function falls back to Natural Minor degrees.
      expect(degrees).toEqual(getDegreesForScale('minor'));
    });

    it('returns Natural Minor degrees for unknown scale without interval 4', () => {
      const degrees = getDegreesForScale('Unknown Minor-like');
      // Should fall back to Natural Minor
      expect(degrees).toEqual(getDegreesForScale('minor'));
    });
  });

  describe('Pentatonic and blues scales', () => {
    it('returns scale-step degree labels for Major Pentatonic', () => {
      const degrees = getDegreesForScale('major pentatonic');
      expect(degrees).toEqual({
        0: "I",
        2: "ii",
        4: "iii",
        7: "V",
        9: "vi",
      });
    });

    it('returns scale-step degree labels for Minor Pentatonic', () => {
      const degrees = getDegreesForScale('minor pentatonic');
      expect(degrees).toEqual({
        0: "i",
        3: "III",
        5: "iv",
        7: "v",
        10: "VII",
      });
    });

    it('returns pentatonic degree labels for Minor Blues', () => {
      const degrees = getDegreesForScale('minor blues');
      expect(degrees).toEqual({
        0: "i",
        3: "III",
        5: "iv",
        7: "v",
        10: "VII",
      });
    });

    it('returns pentatonic degree labels for Major Blues', () => {
      const degrees = getDegreesForScale('major blues');
      expect(degrees).toEqual({
        0: "I",
        2: "ii",
        4: "iii",
        7: "V",
        9: "vi",
      });
    });
  });

  describe('non-7-note scale fallback strategy', () => {
    it('returns Major-family chord qualities for Major Pentatonic degrees', () => {
      expect(getQualityForDegree("I", "major pentatonic")).toBe("M");
      expect(getQualityForDegree("ii", "major pentatonic")).toBe("m");
      expect(getQualityForDegree("iii", "major pentatonic")).toBe("m");
      expect(getQualityForDegree("V", "major pentatonic")).toBe("M");
      expect(getQualityForDegree("vi", "major pentatonic")).toBe("m");
    });

    it('returns Natural-Minor-family chord qualities for Minor Pentatonic degrees', () => {
      expect(getQualityForDegree("i", "minor pentatonic")).toBe("m");
      expect(getQualityForDegree("III", "minor pentatonic")).toBe("M");
      expect(getQualityForDegree("iv", "minor pentatonic")).toBe("m");
      expect(getQualityForDegree("v", "minor pentatonic")).toBe("m");
      expect(getQualityForDegree("VII", "minor pentatonic")).toBe("M");
    });

    it('returns chord qualities for Major Blues degrees', () => {
      expect(getQualityForDegree("I", "major blues")).toBe("M");
      expect(getQualityForDegree("ii", "major blues")).toBe("m");
      expect(getQualityForDegree("iii", "major blues")).toBe("m");
      expect(getQualityForDegree("V", "major blues")).toBe("M");
      expect(getQualityForDegree("vi", "major blues")).toBe("m");
      expect(getQualityForDegree("b3", "major blues")).toBeUndefined();
    });

    it('returns chord qualities for Minor Blues degrees', () => {
      expect(getQualityForDegree("i", "minor blues")).toBe("m");
      expect(getQualityForDegree("III", "minor blues")).toBe("M");
      expect(getQualityForDegree("iv", "minor blues")).toBe("m");
      expect(getQualityForDegree("v", "minor blues")).toBe("m");
      expect(getQualityForDegree("VII", "minor blues")).toBe("M");
      expect(getQualityForDegree("b5", "minor blues")).toBeUndefined();
    });
  });
});

describe('getQualityForDegree', () => {
  describe('Major scale — all 7 degrees', () => {
    it('I → Major Triad', () => {
      expect(getQualityForDegree('I', 'major')).toBe('M');
    });

    it('ii → Minor Triad', () => {
      expect(getQualityForDegree('ii', 'major')).toBe('m');
    });

    it('iii → Minor Triad', () => {
      expect(getQualityForDegree('iii', 'major')).toBe('m');
    });

    it('IV → Major Triad', () => {
      expect(getQualityForDegree('IV', 'major')).toBe('M');
    });

    it('V → Major Triad', () => {
      expect(getQualityForDegree('V', 'major')).toBe('M');
    });

    it('vi → Minor Triad', () => {
      expect(getQualityForDegree('vi', 'major')).toBe('m');
    });

    it('vii° → Diminished Triad', () => {
      expect(getQualityForDegree('vii°', 'major')).toBe('dim');
    });
  });

  describe('Natural Minor scale — all 7 degrees', () => {
    it('i → Minor Triad', () => {
      expect(getQualityForDegree('i', 'minor')).toBe('m');
    });

    it('ii° → Diminished Triad', () => {
      expect(getQualityForDegree('ii°', 'minor')).toBe('dim');
    });

    it('III → Major Triad', () => {
      expect(getQualityForDegree('III', 'minor')).toBe('M');
    });

    it('iv → Minor Triad', () => {
      expect(getQualityForDegree('iv', 'minor')).toBe('m');
    });

    it('v → Minor Triad', () => {
      expect(getQualityForDegree('v', 'minor')).toBe('m');
    });

    it('VI → Major Triad', () => {
      expect(getQualityForDegree('VI', 'minor')).toBe('M');
    });

    it('VII → Major Triad', () => {
      expect(getQualityForDegree('VII', 'minor')).toBe('M');
    });
  });

  describe('Dorian — spot checks', () => {
    it('i → Minor Triad', () => {
      expect(getQualityForDegree('i', 'dorian')).toBe('m');
    });

    it('IV → Major Triad', () => {
      expect(getQualityForDegree('IV', 'dorian')).toBe('M');
    });

    it('vi° → Diminished Triad', () => {
      expect(getQualityForDegree('vi°', 'dorian')).toBe('dim');
    });
  });

  describe('Harmonic Minor — edge cases', () => {
    it('V at semitone 7 → Major Triad (raised 7th makes dominant major)', () => {
      expect(getQualityForDegree('V', 'harmonic minor')).toBe('M');
    });

    it('III+ at semitone 3 → Major Triad (pragmatic fallback: CHORD_DEFINITIONS has no Augmented Triad)', () => {
      expect(getQualityForDegree('III+', 'harmonic minor')).toBe('M');
    });
  });

  describe('Lydian — raised 4th edge case', () => {
    it('iv° at semitone 6 → Diminished Triad (F#-A-C: minor 3rd + diminished 5th)', () => {
      expect(getQualityForDegree('iv°', 'lydian')).toBe('dim');
    });
  });

  describe('Unknown inputs', () => {
    it('returns undefined for an unknown scale', () => {
      expect(getQualityForDegree('I', 'Unknown Scale')).toBeUndefined();
    });

    it('returns undefined for an unknown degree in a known scale', () => {
      expect(getQualityForDegree('XI', 'major')).toBeUndefined();
    });
  });

  describe('getQualityForDegree algorithmic fallback — Melodic Minor modes', () => {
    // Melodic Minor [0,2,3,5,7,9,11]
    // Degrees: i ii III+ IV V vi° vii°
    describe('Melodic Minor (Jazz Minor)', () => {
      it('i → Minor Triad', () => {
        expect(getQualityForDegree('i', 'melodic minor')).toBe('m');
      });

      it('ii → Minor Triad', () => {
        expect(getQualityForDegree('ii', 'melodic minor')).toBe('m');
      });

      it('III+ → Major Triad (augmented collapses to Major: no Augmented Triad in chord definitions)', () => {
        expect(getQualityForDegree('III+', 'melodic minor')).toBe('M');
      });

      it('IV → Major Triad', () => {
        expect(getQualityForDegree('IV', 'melodic minor')).toBe('M');
      });

      it('V → Major Triad', () => {
        expect(getQualityForDegree('V', 'melodic minor')).toBe('M');
      });

      it('vi° → Diminished Triad', () => {
        expect(getQualityForDegree('vi°', 'melodic minor')).toBe('dim');
      });

      it('vii° → Diminished Triad', () => {
        expect(getQualityForDegree('vii°', 'melodic minor')).toBe('dim');
      });
    });

    // Dorian Flat 2 [0,1,3,5,7,9,10]
    // Degrees: i II+ III IV v° vi° vii
    describe('Dorian Flat 2 (2nd mode)', () => {
      it('i → Minor Triad', () => {
        expect(getQualityForDegree('i', 'dorian b2')).toBe('m');
      });

      it('II+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('II+', 'dorian b2')).toBe('M');
      });

      it('III → Major Triad', () => {
        expect(getQualityForDegree('III', 'dorian b2')).toBe('M');
      });

      it('IV → Major Triad', () => {
        expect(getQualityForDegree('IV', 'dorian b2')).toBe('M');
      });

      it('v° → Diminished Triad', () => {
        expect(getQualityForDegree('v°', 'dorian b2')).toBe('dim');
      });

      it('vi° → Diminished Triad', () => {
        expect(getQualityForDegree('vi°', 'dorian b2')).toBe('dim');
      });

      it('vii → Minor Triad', () => {
        expect(getQualityForDegree('vii', 'dorian b2')).toBe('m');
      });
    });

    // Lydian Augmented [0,2,4,6,8,9,11]
    // Degrees: I+ II III iv° v° vi vii
    describe('Lydian Augmented (3rd mode)', () => {
      it('I+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('I+', 'lydian augmented')).toBe('M');
      });

      it('II → Major Triad', () => {
        expect(getQualityForDegree('II', 'lydian augmented')).toBe('M');
      });

      it('III → Major Triad', () => {
        expect(getQualityForDegree('III', 'lydian augmented')).toBe('M');
      });

      it('iv° → Diminished Triad', () => {
        expect(getQualityForDegree('iv°', 'lydian augmented')).toBe('dim');
      });

      it('v° → Diminished Triad', () => {
        expect(getQualityForDegree('v°', 'lydian augmented')).toBe('dim');
      });

      it('vi → Minor Triad', () => {
        expect(getQualityForDegree('vi', 'lydian augmented')).toBe('m');
      });

      it('vii → Minor Triad', () => {
        expect(getQualityForDegree('vii', 'lydian augmented')).toBe('m');
      });
    });

    // Lydian Dominant [0,2,4,6,7,9,10]
    // Degrees: I II iii° iv° v vi VII+
    describe('Lydian Dominant (4th mode)', () => {
      it('I → Major Triad', () => {
        expect(getQualityForDegree('I', 'lydian dominant')).toBe('M');
      });

      it('II → Major Triad', () => {
        expect(getQualityForDegree('II', 'lydian dominant')).toBe('M');
      });

      it('iii° → Diminished Triad', () => {
        expect(getQualityForDegree('iii°', 'lydian dominant')).toBe('dim');
      });

      it('iv° → Diminished Triad', () => {
        expect(getQualityForDegree('iv°', 'lydian dominant')).toBe('dim');
      });

      it('v → Minor Triad', () => {
        expect(getQualityForDegree('v', 'lydian dominant')).toBe('m');
      });

      it('vi → Minor Triad', () => {
        expect(getQualityForDegree('vi', 'lydian dominant')).toBe('m');
      });

      it('VII+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('VII+', 'lydian dominant')).toBe('M');
      });
    });

    // Mixolydian Flat 6 [0,2,4,5,7,8,10]
    // Degrees: I ii° iii° iv v VI+ VII
    describe('Mixolydian Flat 6 (5th mode)', () => {
      it('I → Major Triad', () => {
        expect(getQualityForDegree('I', 'mixolydian b6')).toBe('M');
      });

      it('ii° → Diminished Triad', () => {
        expect(getQualityForDegree('ii°', 'mixolydian b6')).toBe('dim');
      });

      it('iii° → Diminished Triad', () => {
        expect(getQualityForDegree('iii°', 'mixolydian b6')).toBe('dim');
      });

      it('iv → Minor Triad', () => {
        expect(getQualityForDegree('iv', 'mixolydian b6')).toBe('m');
      });

      it('v → Minor Triad', () => {
        expect(getQualityForDegree('v', 'mixolydian b6')).toBe('m');
      });

      it('VI+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('VI+', 'mixolydian b6')).toBe('M');
      });

      it('VII → Major Triad', () => {
        expect(getQualityForDegree('VII', 'mixolydian b6')).toBe('M');
      });
    });

    // Locrian Natural 2 [0,2,3,5,6,8,10]
    // Degrees: i° ii° iii iv V+ VI VII
    describe('Locrian Natural 2 (6th mode)', () => {
      it('i° → Diminished Triad', () => {
        expect(getQualityForDegree('i°', 'locrian #2')).toBe('dim');
      });

      it('ii° → Diminished Triad', () => {
        expect(getQualityForDegree('ii°', 'locrian #2')).toBe('dim');
      });

      it('iii → Minor Triad', () => {
        expect(getQualityForDegree('iii', 'locrian #2')).toBe('m');
      });

      it('iv → Minor Triad', () => {
        expect(getQualityForDegree('iv', 'locrian #2')).toBe('m');
      });

      it('V+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('V+', 'locrian #2')).toBe('M');
      });

      it('VI → Major Triad', () => {
        expect(getQualityForDegree('VI', 'locrian #2')).toBe('M');
      });

      it('VII → Major Triad', () => {
        expect(getQualityForDegree('VII', 'locrian #2')).toBe('M');
      });
    });

    // Altered [0,1,3,4,6,8,10]
    // Degrees: i° ii iii IV+ V VI vii°
    describe('Altered (7th mode)', () => {
      it('i° → Diminished Triad', () => {
        expect(getQualityForDegree('i°', 'altered')).toBe('dim');
      });

      it('ii → Minor Triad', () => {
        expect(getQualityForDegree('ii', 'altered')).toBe('m');
      });

      it('iii → Minor Triad', () => {
        expect(getQualityForDegree('iii', 'altered')).toBe('m');
      });

      it('IV+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('IV+', 'altered')).toBe('M');
      });

      it('V → Major Triad', () => {
        expect(getQualityForDegree('V', 'altered')).toBe('M');
      });

      it('VI → Major Triad', () => {
        expect(getQualityForDegree('VI', 'altered')).toBe('M');
      });

      it('vii° → Diminished Triad', () => {
        expect(getQualityForDegree('vii°', 'altered')).toBe('dim');
      });
    });
  });
});

describe('getAdjacentDegree', () => {
  describe('Major scale — forward step', () => {
    it('I + direction(+1) → ii', () => {
      expect(getAdjacentDegree('I', 'major', 1)).toBe('ii');
    });

    it('vi + direction(+1) → vii°', () => {
      expect(getAdjacentDegree('vi', 'major', 1)).toBe('vii°');
    });

    it('vii° + direction(+1) wraps to I', () => {
      expect(getAdjacentDegree('vii°', 'major', 1)).toBe('I');
    });
  });

  describe('Major scale — backward step', () => {
    it('ii + direction(-1) → I', () => {
      expect(getAdjacentDegree('ii', 'major', -1)).toBe('I');
    });

    it('I + direction(-1) wraps to vii°', () => {
      expect(getAdjacentDegree('I', 'major', -1)).toBe('vii°');
    });
  });

  describe('Natural Minor scale — forward step', () => {
    it('i + direction(+1) → ii°', () => {
      expect(getAdjacentDegree('i', 'minor', 1)).toBe('ii°');
    });

    it('VII (last degree) + direction(+1) wraps to i', () => {
      expect(getAdjacentDegree('VII', 'minor', 1)).toBe('i');
    });
  });

  describe('Null input — returns first degree regardless of direction', () => {
    it('null + direction(+1) → first degree of Major ("I")', () => {
      expect(getAdjacentDegree(null, 'major', 1)).toBe('I');
    });

    it('null + direction(-1) → first degree of Major ("I")', () => {
      expect(getAdjacentDegree(null, 'major', -1)).toBe('I');
    });
  });

  describe('Unknown degree falls back gracefully', () => {
    it('"IX" (nonexistent) + direction(+1) on Major → returns "I" (first degree)', () => {
      expect(getAdjacentDegree('IX', 'major', 1)).toBe('I');
    });
  });
});

describe('remapDegreeForScale', () => {
  it('same scale → returns input unchanged', () => {
    expect(remapDegreeForScale('I', 'major', 'major')).toBe('I');
    expect(remapDegreeForScale('vii°', 'major', 'major')).toBe('vii°');
  });

  it('Major → Dorian: I (semitone 0, Major Triad) → i (semitone 0, Minor Triad)', () => {
    expect(remapDegreeForScale('I', 'major', 'dorian')).toBe('i');
  });

  it('Major → Mixolydian: V (semitone 7, Major Triad) → v (semitone 7, Minor Triad)', () => {
    expect(remapDegreeForScale('V', 'major', 'mixolydian')).toBe('v');
  });

  it('Major → Lydian: V (semitone 7) → V (semitone 7) — both Major Triad', () => {
    expect(remapDegreeForScale('V', 'major', 'lydian')).toBe('V');
  });

  it('Dorian → Major: i (semitone 0) → I (semitone 0)', () => {
    expect(remapDegreeForScale('i', 'dorian', 'major')).toBe('I');
  });

  it('Major → Phrygian: ii (semitone 2) → null (Phrygian has no degree at semitone 2; II at semitone 1 instead)', () => {
    // Major's ii is at semitone 2; Phrygian's degrees are at 0,1,3,5,7,8,10. No degree at semitone 2.
    expect(remapDegreeForScale('ii', 'major', 'phrygian')).toBeNull();
  });

  it('unknown degree → null', () => {
    expect(remapDegreeForScale('IX', 'major', 'dorian')).toBeNull();
  });

  it('Major → Natural Minor: vi (semitone 9) → null (Natural Minor has no degree at semitone 9)', () => {
    // Major's vi sits on the 9th semitone above the tonic. Natural Minor's
    // sixth-degree triad is rooted on semitone 8 instead, so semitone 9 has
    // no diatonic degree to remap into.
    expect(remapDegreeForScale('vi', 'major', 'minor')).toBeNull();
  });

  it('Major → Harmonic Minor: V (semitone 7) → V (semitone 7) — both Major Triad', () => {
    // Harmonic Minor's V is intentionally raised — semitone 7 stays Major.
    expect(remapDegreeForScale('V', 'major', 'harmonic minor')).toBe('V');
  });
});

describe("diatonic-quality alignment with Tonal (drift detection)", () => {
  it("Major diatonic triads match Tonal", () => {
    expect(_validateDiatonicQualitiesAgainstTonal("major")).toBe(true);
  });
  it("Natural Minor diatonic triads match Tonal", () => {
    expect(_validateDiatonicQualitiesAgainstTonal("minor")).toBe(true);
  });
});

describe("degree outputs snapshot (pre-Tonal-migration lock)", () => {
  it("getDegreesForScale across all 28 scales", () => {
    const snapshot: Record<string, Record<number, string>> = {};
    for (const scaleName of Object.keys(SCALES)) {
      snapshot[scaleName] = getDegreesForScale(scaleName);
    }
    expect(snapshot).toMatchSnapshot();
  });

  it("getDegreeSequence across all 28 scales", () => {
    const snapshot: Record<string, string[]> = {};
    for (const scaleName of Object.keys(SCALES)) {
      snapshot[scaleName] = getDegreeSequence(scaleName);
    }
    expect(snapshot).toMatchSnapshot();
  });

  it("getQualityForDegree for every (scale, degree) pair the catalog produces", () => {
    const snapshot: Record<string, Record<string, string | undefined>> = {};
    for (const scaleName of Object.keys(SCALES)) {
      const degrees = getDegreeSequence(scaleName);
      const inner: Record<string, string | undefined> = {};
      for (const degree of degrees) {
        inner[degree] = getQualityForDegree(degree, scaleName);
      }
      snapshot[scaleName] = inner;
    }
    expect(snapshot).toMatchSnapshot();
  });
});

describe('Tonal round-trip — degree labels parse via RomanNumeral.get', () => {
  // Every Roman-numeral label produced by getDegreesForScale should be parseable
  // by Tonal's @tonaljs/roman-numeral. This is a guard rail: if we ever emit a
  // label Tonal can't understand (e.g. an exotic suffix), it surfaces here so
  // we can either align our notation or document the divergence.
  //
  // KNOWN DIVERGENCE: Tonal does not parse the unicode degree suffix "°"
  // (diminished triad marker). RomanNumeral.get("vii°") returns an empty
  // entry. We keep "°" in our labels for display, so we strip it before
  // round-tripping. This is intentional — see degrees.ts buildDegreeLabel.
  it('every degree label parses via Tonal RomanNumeral.get (with "°" stripped)', () => {
    for (const scaleName of Object.keys(SCALES)) {
      const degrees = getDegreesForScale(scaleName);
      for (const label of Object.values(degrees)) {
        const canonical = label.replace(/°/g, '');
        const parsed = RomanNumeral.get(canonical);
        expect(parsed.empty,
          `RomanNumeral failed to parse "${canonical}" (original "${label}") in scale "${scaleName}"`
        ).toBe(false);
      }
    }
  });
});
