import { describe, it, expect } from 'vitest';
import {
  BLUE_NOTE_COLOR,
  DEGREE_COLORS,
  getAdjacentDegree,
  getDegreesForScale,
  getDegreeSequence,
  getQualityForDegree,
  remapDegreeForScale,
  _validateDiatonicQualitiesAgainstTonal,
} from './degrees';
import { SCALES } from './theoryCatalog';

const BASE_DEGREE_COLOR_KEYS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;

function hexToRgb(color: string) {
  return [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255);
}

function toLinearSrgb(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function toOklab(color: string) {
  const [r, g, b] = hexToRgb(color).map(toLinearSrgb);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

function oklabDistance(a: string, b: string) {
  const [aL, aA, aB] = toOklab(a);
  const [bL, bA, bB] = toOklab(b);
  return Math.hypot(aL - bL, aA - bA, aB - bB);
}

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
      expect(getQualityForDegree("I", "major pentatonic")).toBe("Major Triad");
      expect(getQualityForDegree("ii", "major pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("iii", "major pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("V", "major pentatonic")).toBe("Major Triad");
      expect(getQualityForDegree("vi", "major pentatonic")).toBe("Minor Triad");
    });

    it('returns Natural-Minor-family chord qualities for Minor Pentatonic degrees', () => {
      expect(getQualityForDegree("i", "minor pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("III", "minor pentatonic")).toBe("Major Triad");
      expect(getQualityForDegree("iv", "minor pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("v", "minor pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("VII", "minor pentatonic")).toBe("Major Triad");
    });

    it('returns chord qualities for Major Blues degrees', () => {
      expect(getQualityForDegree("I", "major blues")).toBe("Major Triad");
      expect(getQualityForDegree("ii", "major blues")).toBe("Minor Triad");
      expect(getQualityForDegree("iii", "major blues")).toBe("Minor Triad");
      expect(getQualityForDegree("V", "major blues")).toBe("Major Triad");
      expect(getQualityForDegree("vi", "major blues")).toBe("Minor Triad");
      expect(getQualityForDegree("b3", "major blues")).toBeUndefined();
    });

    it('returns chord qualities for Minor Blues degrees', () => {
      expect(getQualityForDegree("i", "minor blues")).toBe("Minor Triad");
      expect(getQualityForDegree("III", "minor blues")).toBe("Major Triad");
      expect(getQualityForDegree("iv", "minor blues")).toBe("Minor Triad");
      expect(getQualityForDegree("v", "minor blues")).toBe("Minor Triad");
      expect(getQualityForDegree("VII", "minor blues")).toBe("Major Triad");
      expect(getQualityForDegree("b5", "minor blues")).toBeUndefined();
    });
  });
});

describe('DEGREE_COLORS', () => {
  it('has color for tonic (I/i/i°)', () => {
    expect(DEGREE_COLORS['I']).toBeDefined();
    expect(DEGREE_COLORS['i']).toBeDefined();
    expect(DEGREE_COLORS['i°']).toBeDefined();
    expect(DEGREE_COLORS['I']).toBe(DEGREE_COLORS['i']);
  });

  it('has color for supertonic (II/ii/ii°)', () => {
    expect(DEGREE_COLORS['II']).toBeDefined();
    expect(DEGREE_COLORS['ii']).toBeDefined();
    expect(DEGREE_COLORS['ii°']).toBeDefined();
  });

  it('has color for mediant (III/iii/iii°/III+)', () => {
    expect(DEGREE_COLORS['III']).toBeDefined();
    expect(DEGREE_COLORS['iii']).toBeDefined();
    expect(DEGREE_COLORS['iii°']).toBeDefined();
    expect(DEGREE_COLORS['III+']).toBeDefined();
  });

  it('has color for subdominant (IV/iv/iv°)', () => {
    expect(DEGREE_COLORS['IV']).toBeDefined();
    expect(DEGREE_COLORS['iv']).toBeDefined();
    expect(DEGREE_COLORS['iv°']).toBeDefined();
  });

  it('has color for dominant (V/v/v°)', () => {
    expect(DEGREE_COLORS['V']).toBeDefined();
    expect(DEGREE_COLORS['v']).toBeDefined();
    expect(DEGREE_COLORS['v°']).toBeDefined();
  });

  it('has color for submediant (VI/vi/vi°)', () => {
    expect(DEGREE_COLORS['VI']).toBeDefined();
    expect(DEGREE_COLORS['vi']).toBeDefined();
    expect(DEGREE_COLORS['vi°']).toBeDefined();
  });

  it('has color for leading tone (VII/vii/vii°)', () => {
    expect(DEGREE_COLORS['VII']).toBeDefined();
    expect(DEGREE_COLORS['vii']).toBeDefined();
    expect(DEGREE_COLORS['vii°']).toBeDefined();
  });

  it('all color values are valid hex colors', () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    Object.values(DEGREE_COLORS).forEach((color) => {
      expect(color).toMatch(hexRegex);
    });
  });

  it('uses visually separated base degree colors', () => {
    const baseColors = BASE_DEGREE_COLOR_KEYS.map((degree) => DEGREE_COLORS[degree]);

    expect(new Set(baseColors)).toHaveLength(BASE_DEGREE_COLOR_KEYS.length);
    for (let i = 0; i < baseColors.length; i++) {
      for (let j = i + 1; j < baseColors.length; j++) {
        expect(oklabDistance(baseColors[i], baseColors[j])).toBeGreaterThanOrEqual(0.14);
      }
    }
  });

  it("keeps dominant and leading-tone colors strongly separated", () => {
    expect(oklabDistance(DEGREE_COLORS["V"], DEGREE_COLORS["VII"])).toBeGreaterThanOrEqual(0.3);
  });

  it("has a distinct blue-note color for blues-scale color tones", () => {
    expect(DEGREE_COLORS["b3"]).toBe(BLUE_NOTE_COLOR);
    expect(DEGREE_COLORS["b5"]).toBe(BLUE_NOTE_COLOR);
    expect(BLUE_NOTE_COLOR).not.toBe(DEGREE_COLORS["II"]);
    expect(BLUE_NOTE_COLOR).not.toBe(DEGREE_COLORS["VII"]);
  });

  it('has consistent coloring for same degree (upper/lower case variants)', () => {
    // All I/i variants should be same color
    expect(DEGREE_COLORS['I']).toBe(DEGREE_COLORS['i']);
    expect(DEGREE_COLORS['i']).toBe(DEGREE_COLORS['i°']);
  });
});

describe('getQualityForDegree', () => {
  describe('Major scale — all 7 degrees', () => {
    it('I → Major Triad', () => {
      expect(getQualityForDegree('I', 'major')).toBe('Major Triad');
    });

    it('ii → Minor Triad', () => {
      expect(getQualityForDegree('ii', 'major')).toBe('Minor Triad');
    });

    it('iii → Minor Triad', () => {
      expect(getQualityForDegree('iii', 'major')).toBe('Minor Triad');
    });

    it('IV → Major Triad', () => {
      expect(getQualityForDegree('IV', 'major')).toBe('Major Triad');
    });

    it('V → Major Triad', () => {
      expect(getQualityForDegree('V', 'major')).toBe('Major Triad');
    });

    it('vi → Minor Triad', () => {
      expect(getQualityForDegree('vi', 'major')).toBe('Minor Triad');
    });

    it('vii° → Diminished Triad', () => {
      expect(getQualityForDegree('vii°', 'major')).toBe('Diminished Triad');
    });
  });

  describe('Natural Minor scale — all 7 degrees', () => {
    it('i → Minor Triad', () => {
      expect(getQualityForDegree('i', 'minor')).toBe('Minor Triad');
    });

    it('ii° → Diminished Triad', () => {
      expect(getQualityForDegree('ii°', 'minor')).toBe('Diminished Triad');
    });

    it('III → Major Triad', () => {
      expect(getQualityForDegree('III', 'minor')).toBe('Major Triad');
    });

    it('iv → Minor Triad', () => {
      expect(getQualityForDegree('iv', 'minor')).toBe('Minor Triad');
    });

    it('v → Minor Triad', () => {
      expect(getQualityForDegree('v', 'minor')).toBe('Minor Triad');
    });

    it('VI → Major Triad', () => {
      expect(getQualityForDegree('VI', 'minor')).toBe('Major Triad');
    });

    it('VII → Major Triad', () => {
      expect(getQualityForDegree('VII', 'minor')).toBe('Major Triad');
    });
  });

  describe('Dorian — spot checks', () => {
    it('i → Minor Triad', () => {
      expect(getQualityForDegree('i', 'dorian')).toBe('Minor Triad');
    });

    it('IV → Major Triad', () => {
      expect(getQualityForDegree('IV', 'dorian')).toBe('Major Triad');
    });

    it('vi° → Diminished Triad', () => {
      expect(getQualityForDegree('vi°', 'dorian')).toBe('Diminished Triad');
    });
  });

  describe('Harmonic Minor — edge cases', () => {
    it('V at semitone 7 → Major Triad (raised 7th makes dominant major)', () => {
      expect(getQualityForDegree('V', 'harmonic minor')).toBe('Major Triad');
    });

    it('III+ at semitone 3 → Major Triad (pragmatic fallback: CHORD_DEFINITIONS has no Augmented Triad)', () => {
      expect(getQualityForDegree('III+', 'harmonic minor')).toBe('Major Triad');
    });
  });

  describe('Lydian — raised 4th edge case', () => {
    it('iv° at semitone 6 → Diminished Triad (F#-A-C: minor 3rd + diminished 5th)', () => {
      expect(getQualityForDegree('iv°', 'lydian')).toBe('Diminished Triad');
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
        expect(getQualityForDegree('i', 'melodic minor')).toBe('Minor Triad');
      });

      it('ii → Minor Triad', () => {
        expect(getQualityForDegree('ii', 'melodic minor')).toBe('Minor Triad');
      });

      it('III+ → Major Triad (augmented collapses to Major: no Augmented Triad in chord definitions)', () => {
        expect(getQualityForDegree('III+', 'melodic minor')).toBe('Major Triad');
      });

      it('IV → Major Triad', () => {
        expect(getQualityForDegree('IV', 'melodic minor')).toBe('Major Triad');
      });

      it('V → Major Triad', () => {
        expect(getQualityForDegree('V', 'melodic minor')).toBe('Major Triad');
      });

      it('vi° → Diminished Triad', () => {
        expect(getQualityForDegree('vi°', 'melodic minor')).toBe('Diminished Triad');
      });

      it('vii° → Diminished Triad', () => {
        expect(getQualityForDegree('vii°', 'melodic minor')).toBe('Diminished Triad');
      });
    });

    // Dorian Flat 2 [0,1,3,5,7,9,10]
    // Degrees: i II+ III IV v° vi° vii
    describe('Dorian Flat 2 (2nd mode)', () => {
      it('i → Minor Triad', () => {
        expect(getQualityForDegree('i', 'dorian b2')).toBe('Minor Triad');
      });

      it('II+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('II+', 'dorian b2')).toBe('Major Triad');
      });

      it('III → Major Triad', () => {
        expect(getQualityForDegree('III', 'dorian b2')).toBe('Major Triad');
      });

      it('IV → Major Triad', () => {
        expect(getQualityForDegree('IV', 'dorian b2')).toBe('Major Triad');
      });

      it('v° → Diminished Triad', () => {
        expect(getQualityForDegree('v°', 'dorian b2')).toBe('Diminished Triad');
      });

      it('vi° → Diminished Triad', () => {
        expect(getQualityForDegree('vi°', 'dorian b2')).toBe('Diminished Triad');
      });

      it('vii → Minor Triad', () => {
        expect(getQualityForDegree('vii', 'dorian b2')).toBe('Minor Triad');
      });
    });

    // Lydian Augmented [0,2,4,6,8,9,11]
    // Degrees: I+ II III iv° v° vi vii
    describe('Lydian Augmented (3rd mode)', () => {
      it('I+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('I+', 'lydian augmented')).toBe('Major Triad');
      });

      it('II → Major Triad', () => {
        expect(getQualityForDegree('II', 'lydian augmented')).toBe('Major Triad');
      });

      it('III → Major Triad', () => {
        expect(getQualityForDegree('III', 'lydian augmented')).toBe('Major Triad');
      });

      it('iv° → Diminished Triad', () => {
        expect(getQualityForDegree('iv°', 'lydian augmented')).toBe('Diminished Triad');
      });

      it('v° → Diminished Triad', () => {
        expect(getQualityForDegree('v°', 'lydian augmented')).toBe('Diminished Triad');
      });

      it('vi → Minor Triad', () => {
        expect(getQualityForDegree('vi', 'lydian augmented')).toBe('Minor Triad');
      });

      it('vii → Minor Triad', () => {
        expect(getQualityForDegree('vii', 'lydian augmented')).toBe('Minor Triad');
      });
    });

    // Lydian Dominant [0,2,4,6,7,9,10]
    // Degrees: I II iii° iv° v vi VII+
    describe('Lydian Dominant (4th mode)', () => {
      it('I → Major Triad', () => {
        expect(getQualityForDegree('I', 'lydian dominant')).toBe('Major Triad');
      });

      it('II → Major Triad', () => {
        expect(getQualityForDegree('II', 'lydian dominant')).toBe('Major Triad');
      });

      it('iii° → Diminished Triad', () => {
        expect(getQualityForDegree('iii°', 'lydian dominant')).toBe('Diminished Triad');
      });

      it('iv° → Diminished Triad', () => {
        expect(getQualityForDegree('iv°', 'lydian dominant')).toBe('Diminished Triad');
      });

      it('v → Minor Triad', () => {
        expect(getQualityForDegree('v', 'lydian dominant')).toBe('Minor Triad');
      });

      it('vi → Minor Triad', () => {
        expect(getQualityForDegree('vi', 'lydian dominant')).toBe('Minor Triad');
      });

      it('VII+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('VII+', 'lydian dominant')).toBe('Major Triad');
      });
    });

    // Mixolydian Flat 6 [0,2,4,5,7,8,10]
    // Degrees: I ii° iii° iv v VI+ VII
    describe('Mixolydian Flat 6 (5th mode)', () => {
      it('I → Major Triad', () => {
        expect(getQualityForDegree('I', 'mixolydian b6')).toBe('Major Triad');
      });

      it('ii° → Diminished Triad', () => {
        expect(getQualityForDegree('ii°', 'mixolydian b6')).toBe('Diminished Triad');
      });

      it('iii° → Diminished Triad', () => {
        expect(getQualityForDegree('iii°', 'mixolydian b6')).toBe('Diminished Triad');
      });

      it('iv → Minor Triad', () => {
        expect(getQualityForDegree('iv', 'mixolydian b6')).toBe('Minor Triad');
      });

      it('v → Minor Triad', () => {
        expect(getQualityForDegree('v', 'mixolydian b6')).toBe('Minor Triad');
      });

      it('VI+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('VI+', 'mixolydian b6')).toBe('Major Triad');
      });

      it('VII → Major Triad', () => {
        expect(getQualityForDegree('VII', 'mixolydian b6')).toBe('Major Triad');
      });
    });

    // Locrian Natural 2 [0,2,3,5,6,8,10]
    // Degrees: i° ii° iii iv V+ VI VII
    describe('Locrian Natural 2 (6th mode)', () => {
      it('i° → Diminished Triad', () => {
        expect(getQualityForDegree('i°', 'locrian #2')).toBe('Diminished Triad');
      });

      it('ii° → Diminished Triad', () => {
        expect(getQualityForDegree('ii°', 'locrian #2')).toBe('Diminished Triad');
      });

      it('iii → Minor Triad', () => {
        expect(getQualityForDegree('iii', 'locrian #2')).toBe('Minor Triad');
      });

      it('iv → Minor Triad', () => {
        expect(getQualityForDegree('iv', 'locrian #2')).toBe('Minor Triad');
      });

      it('V+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('V+', 'locrian #2')).toBe('Major Triad');
      });

      it('VI → Major Triad', () => {
        expect(getQualityForDegree('VI', 'locrian #2')).toBe('Major Triad');
      });

      it('VII → Major Triad', () => {
        expect(getQualityForDegree('VII', 'locrian #2')).toBe('Major Triad');
      });
    });

    // Altered [0,1,3,4,6,8,10]
    // Degrees: i° ii iii IV+ V VI vii°
    describe('Altered (7th mode)', () => {
      it('i° → Diminished Triad', () => {
        expect(getQualityForDegree('i°', 'altered')).toBe('Diminished Triad');
      });

      it('ii → Minor Triad', () => {
        expect(getQualityForDegree('ii', 'altered')).toBe('Minor Triad');
      });

      it('iii → Minor Triad', () => {
        expect(getQualityForDegree('iii', 'altered')).toBe('Minor Triad');
      });

      it('IV+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('IV+', 'altered')).toBe('Major Triad');
      });

      it('V → Major Triad', () => {
        expect(getQualityForDegree('V', 'altered')).toBe('Major Triad');
      });

      it('VI → Major Triad', () => {
        expect(getQualityForDegree('VI', 'altered')).toBe('Major Triad');
      });

      it('vii° → Diminished Triad', () => {
        expect(getQualityForDegree('vii°', 'altered')).toBe('Diminished Triad');
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
