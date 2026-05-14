import { describe, it, expect } from 'vitest';
import {
  BLUE_NOTE_COLOR,
  DEGREE_COLORS,
  getAdjacentDegree,
  getDegreesForScale,
  getQualityForDegree,
  remapDegreeForScale,
} from './degrees';

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
      const degrees = getDegreesForScale('Major');
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
      const degrees = getDegreesForScale('Lydian');
      expect(degrees[6]).toBe('iv°'); // Raised 4th as diminished interval
      expect(degrees[0]).toBe('I');
      expect(degrees[7]).toBe('V');
    });

    it('returns Mixolydian degrees for Mixolydian scale', () => {
      const degrees = getDegreesForScale('Mixolydian');
      expect(degrees[10]).toBe('VII'); // Lowered 7th
      expect(degrees[0]).toBe('I');
      expect(degrees[7]).toBe('v'); // Lowered 5th
    });
  });

  describe('Minor modes', () => {
    it('returns Natural Minor degrees for Natural Minor scale', () => {
      const degrees = getDegreesForScale('Natural Minor');
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
      const degrees = getDegreesForScale('Dorian');
      expect(degrees[0]).toBe('i');
      expect(degrees[2]).toBe('ii'); // Major 2nd (vs Natural Minor)
      expect(degrees[9]).toBe('vi°'); // Diminished 6th
    });

    it('returns Phrygian degrees for Phrygian scale', () => {
      const degrees = getDegreesForScale('Phrygian');
      expect(degrees[0]).toBe('i');
      expect(degrees[1]).toBe('II'); // Major 2nd (characteristic)
      expect(degrees[7]).toBe('v°'); // Diminished 5th
    });

    it('returns Locrian degrees for Locrian scale', () => {
      const degrees = getDegreesForScale('Locrian');
      expect(degrees[0]).toBe('i°'); // Diminished root
      expect(degrees[1]).toBe('II');
      expect(degrees[6]).toBe('V'); // Major 5th
    });

    it('returns Harmonic Minor degrees for Harmonic Minor scale', () => {
      const degrees = getDegreesForScale('Harmonic Minor');
      expect(degrees[0]).toBe('i');
      expect(degrees[3]).toBe('III+'); // Augmented (raised 3rd)
      expect(degrees[7]).toBe('V'); // Major 5th (vs natural minor)
      expect(degrees[11]).toBe('vii°'); // Diminished 7th
    });

    it("computes Melodic Minor degrees from diatonic-triad intervals", () => {
      // Melodic Minor [0,2,3,5,7,9,11]:
      //   i (minor) — ii (minor) — III+ (aug) — IV (major) — V (major) — vi° (dim) — vii° (dim)
      const degrees = getDegreesForScale("Melodic Minor");
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
      const degrees = getDegreesForScale("Phrygian Dominant");
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
      const degrees = getDegreesForScale("Lydian Augmented");
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
      expect(degrees).toEqual(getDegreesForScale('Natural Minor'));
    });

    it('returns Natural Minor degrees for unknown scale without interval 4', () => {
      const degrees = getDegreesForScale('Unknown Minor-like');
      // Should fall back to Natural Minor
      expect(degrees).toEqual(getDegreesForScale('Natural Minor'));
    });
  });

  describe('Pentatonic and blues scales', () => {
    it('returns scale-step degree labels for Major Pentatonic', () => {
      const degrees = getDegreesForScale('Major Pentatonic');
      expect(degrees).toEqual({
        0: "I",
        2: "ii",
        4: "iii",
        7: "V",
        9: "vi",
      });
    });

    it('returns scale-step degree labels for Minor Pentatonic', () => {
      const degrees = getDegreesForScale('Minor Pentatonic');
      expect(degrees).toEqual({
        0: "i",
        3: "III",
        5: "iv",
        7: "v",
        10: "VII",
      });
    });

    it('falls back gracefully for Blues scale', () => {
      const degrees = getDegreesForScale('Minor Blues');
      expect(degrees).toBeDefined();
      expect(degrees[0]).toBeDefined(); // Has a root
    });
  });

  describe('non-7-note scale fallback strategy', () => {
    it('returns Major-family chord qualities for Major Pentatonic degrees', () => {
      expect(getQualityForDegree("I", "Major Pentatonic")).toBe("Major Triad");
      expect(getQualityForDegree("ii", "Major Pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("iii", "Major Pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("V", "Major Pentatonic")).toBe("Major Triad");
      expect(getQualityForDegree("vi", "Major Pentatonic")).toBe("Minor Triad");
    });

    it('returns Natural-Minor-family chord qualities for Minor Pentatonic degrees', () => {
      expect(getQualityForDegree("i", "Minor Pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("III", "Minor Pentatonic")).toBe("Major Triad");
      expect(getQualityForDegree("iv", "Minor Pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("v", "Minor Pentatonic")).toBe("Minor Triad");
      expect(getQualityForDegree("VII", "Minor Pentatonic")).toBe("Major Triad");
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
      expect(getQualityForDegree('I', 'Major')).toBe('Major Triad');
    });

    it('ii → Minor Triad', () => {
      expect(getQualityForDegree('ii', 'Major')).toBe('Minor Triad');
    });

    it('iii → Minor Triad', () => {
      expect(getQualityForDegree('iii', 'Major')).toBe('Minor Triad');
    });

    it('IV → Major Triad', () => {
      expect(getQualityForDegree('IV', 'Major')).toBe('Major Triad');
    });

    it('V → Major Triad', () => {
      expect(getQualityForDegree('V', 'Major')).toBe('Major Triad');
    });

    it('vi → Minor Triad', () => {
      expect(getQualityForDegree('vi', 'Major')).toBe('Minor Triad');
    });

    it('vii° → Diminished Triad', () => {
      expect(getQualityForDegree('vii°', 'Major')).toBe('Diminished Triad');
    });
  });

  describe('Natural Minor scale — all 7 degrees', () => {
    it('i → Minor Triad', () => {
      expect(getQualityForDegree('i', 'Natural Minor')).toBe('Minor Triad');
    });

    it('ii° → Diminished Triad', () => {
      expect(getQualityForDegree('ii°', 'Natural Minor')).toBe('Diminished Triad');
    });

    it('III → Major Triad', () => {
      expect(getQualityForDegree('III', 'Natural Minor')).toBe('Major Triad');
    });

    it('iv → Minor Triad', () => {
      expect(getQualityForDegree('iv', 'Natural Minor')).toBe('Minor Triad');
    });

    it('v → Minor Triad', () => {
      expect(getQualityForDegree('v', 'Natural Minor')).toBe('Minor Triad');
    });

    it('VI → Major Triad', () => {
      expect(getQualityForDegree('VI', 'Natural Minor')).toBe('Major Triad');
    });

    it('VII → Major Triad', () => {
      expect(getQualityForDegree('VII', 'Natural Minor')).toBe('Major Triad');
    });
  });

  describe('Dorian — spot checks', () => {
    it('i → Minor Triad', () => {
      expect(getQualityForDegree('i', 'Dorian')).toBe('Minor Triad');
    });

    it('IV → Major Triad', () => {
      expect(getQualityForDegree('IV', 'Dorian')).toBe('Major Triad');
    });

    it('vi° → Diminished Triad', () => {
      expect(getQualityForDegree('vi°', 'Dorian')).toBe('Diminished Triad');
    });
  });

  describe('Harmonic Minor — edge cases', () => {
    it('V at semitone 7 → Major Triad (raised 7th makes dominant major)', () => {
      expect(getQualityForDegree('V', 'Harmonic Minor')).toBe('Major Triad');
    });

    it('III+ at semitone 3 → Major Triad (pragmatic fallback: CHORD_DEFINITIONS has no Augmented Triad)', () => {
      expect(getQualityForDegree('III+', 'Harmonic Minor')).toBe('Major Triad');
    });
  });

  describe('Lydian — raised 4th edge case', () => {
    it('iv° at semitone 6 → Diminished Triad (F#-A-C: minor 3rd + diminished 5th)', () => {
      expect(getQualityForDegree('iv°', 'Lydian')).toBe('Diminished Triad');
    });
  });

  describe('Unknown inputs', () => {
    it('returns undefined for an unknown scale', () => {
      expect(getQualityForDegree('I', 'Unknown Scale')).toBeUndefined();
    });

    it('returns undefined for an unknown degree in a known scale', () => {
      expect(getQualityForDegree('XI', 'Major')).toBeUndefined();
    });
  });

  describe('getQualityForDegree algorithmic fallback — Melodic Minor modes', () => {
    // Melodic Minor [0,2,3,5,7,9,11]
    // Degrees: i ii III+ IV V vi° vii°
    describe('Melodic Minor (Jazz Minor)', () => {
      it('i → Minor Triad', () => {
        expect(getQualityForDegree('i', 'Melodic Minor')).toBe('Minor Triad');
      });

      it('ii → Minor Triad', () => {
        expect(getQualityForDegree('ii', 'Melodic Minor')).toBe('Minor Triad');
      });

      it('III+ → Major Triad (augmented collapses to Major: no Augmented Triad in chord definitions)', () => {
        expect(getQualityForDegree('III+', 'Melodic Minor')).toBe('Major Triad');
      });

      it('IV → Major Triad', () => {
        expect(getQualityForDegree('IV', 'Melodic Minor')).toBe('Major Triad');
      });

      it('V → Major Triad', () => {
        expect(getQualityForDegree('V', 'Melodic Minor')).toBe('Major Triad');
      });

      it('vi° → Diminished Triad', () => {
        expect(getQualityForDegree('vi°', 'Melodic Minor')).toBe('Diminished Triad');
      });

      it('vii° → Diminished Triad', () => {
        expect(getQualityForDegree('vii°', 'Melodic Minor')).toBe('Diminished Triad');
      });
    });

    // Dorian Flat 2 [0,1,3,5,7,9,10]
    // Degrees: i II+ III IV v° vi° vii
    describe('Dorian Flat 2 (2nd mode)', () => {
      it('i → Minor Triad', () => {
        expect(getQualityForDegree('i', 'Dorian Flat 2')).toBe('Minor Triad');
      });

      it('II+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('II+', 'Dorian Flat 2')).toBe('Major Triad');
      });

      it('III → Major Triad', () => {
        expect(getQualityForDegree('III', 'Dorian Flat 2')).toBe('Major Triad');
      });

      it('IV → Major Triad', () => {
        expect(getQualityForDegree('IV', 'Dorian Flat 2')).toBe('Major Triad');
      });

      it('v° → Diminished Triad', () => {
        expect(getQualityForDegree('v°', 'Dorian Flat 2')).toBe('Diminished Triad');
      });

      it('vi° → Diminished Triad', () => {
        expect(getQualityForDegree('vi°', 'Dorian Flat 2')).toBe('Diminished Triad');
      });

      it('vii → Minor Triad', () => {
        expect(getQualityForDegree('vii', 'Dorian Flat 2')).toBe('Minor Triad');
      });
    });

    // Lydian Augmented [0,2,4,6,8,9,11]
    // Degrees: I+ II III iv° v° vi vii
    describe('Lydian Augmented (3rd mode)', () => {
      it('I+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('I+', 'Lydian Augmented')).toBe('Major Triad');
      });

      it('II → Major Triad', () => {
        expect(getQualityForDegree('II', 'Lydian Augmented')).toBe('Major Triad');
      });

      it('III → Major Triad', () => {
        expect(getQualityForDegree('III', 'Lydian Augmented')).toBe('Major Triad');
      });

      it('iv° → Diminished Triad', () => {
        expect(getQualityForDegree('iv°', 'Lydian Augmented')).toBe('Diminished Triad');
      });

      it('v° → Diminished Triad', () => {
        expect(getQualityForDegree('v°', 'Lydian Augmented')).toBe('Diminished Triad');
      });

      it('vi → Minor Triad', () => {
        expect(getQualityForDegree('vi', 'Lydian Augmented')).toBe('Minor Triad');
      });

      it('vii → Minor Triad', () => {
        expect(getQualityForDegree('vii', 'Lydian Augmented')).toBe('Minor Triad');
      });
    });

    // Lydian Dominant [0,2,4,6,7,9,10]
    // Degrees: I II iii° iv° v vi VII+
    describe('Lydian Dominant (4th mode)', () => {
      it('I → Major Triad', () => {
        expect(getQualityForDegree('I', 'Lydian Dominant')).toBe('Major Triad');
      });

      it('II → Major Triad', () => {
        expect(getQualityForDegree('II', 'Lydian Dominant')).toBe('Major Triad');
      });

      it('iii° → Diminished Triad', () => {
        expect(getQualityForDegree('iii°', 'Lydian Dominant')).toBe('Diminished Triad');
      });

      it('iv° → Diminished Triad', () => {
        expect(getQualityForDegree('iv°', 'Lydian Dominant')).toBe('Diminished Triad');
      });

      it('v → Minor Triad', () => {
        expect(getQualityForDegree('v', 'Lydian Dominant')).toBe('Minor Triad');
      });

      it('vi → Minor Triad', () => {
        expect(getQualityForDegree('vi', 'Lydian Dominant')).toBe('Minor Triad');
      });

      it('VII+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('VII+', 'Lydian Dominant')).toBe('Major Triad');
      });
    });

    // Mixolydian Flat 6 [0,2,4,5,7,8,10]
    // Degrees: I ii° iii° iv v VI+ VII
    describe('Mixolydian Flat 6 (5th mode)', () => {
      it('I → Major Triad', () => {
        expect(getQualityForDegree('I', 'Mixolydian Flat 6')).toBe('Major Triad');
      });

      it('ii° → Diminished Triad', () => {
        expect(getQualityForDegree('ii°', 'Mixolydian Flat 6')).toBe('Diminished Triad');
      });

      it('iii° → Diminished Triad', () => {
        expect(getQualityForDegree('iii°', 'Mixolydian Flat 6')).toBe('Diminished Triad');
      });

      it('iv → Minor Triad', () => {
        expect(getQualityForDegree('iv', 'Mixolydian Flat 6')).toBe('Minor Triad');
      });

      it('v → Minor Triad', () => {
        expect(getQualityForDegree('v', 'Mixolydian Flat 6')).toBe('Minor Triad');
      });

      it('VI+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('VI+', 'Mixolydian Flat 6')).toBe('Major Triad');
      });

      it('VII → Major Triad', () => {
        expect(getQualityForDegree('VII', 'Mixolydian Flat 6')).toBe('Major Triad');
      });
    });

    // Locrian Natural 2 [0,2,3,5,6,8,10]
    // Degrees: i° ii° iii iv V+ VI VII
    describe('Locrian Natural 2 (6th mode)', () => {
      it('i° → Diminished Triad', () => {
        expect(getQualityForDegree('i°', 'Locrian Natural 2')).toBe('Diminished Triad');
      });

      it('ii° → Diminished Triad', () => {
        expect(getQualityForDegree('ii°', 'Locrian Natural 2')).toBe('Diminished Triad');
      });

      it('iii → Minor Triad', () => {
        expect(getQualityForDegree('iii', 'Locrian Natural 2')).toBe('Minor Triad');
      });

      it('iv → Minor Triad', () => {
        expect(getQualityForDegree('iv', 'Locrian Natural 2')).toBe('Minor Triad');
      });

      it('V+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('V+', 'Locrian Natural 2')).toBe('Major Triad');
      });

      it('VI → Major Triad', () => {
        expect(getQualityForDegree('VI', 'Locrian Natural 2')).toBe('Major Triad');
      });

      it('VII → Major Triad', () => {
        expect(getQualityForDegree('VII', 'Locrian Natural 2')).toBe('Major Triad');
      });
    });

    // Altered [0,1,3,4,6,8,10]
    // Degrees: i° ii iii IV+ V VI vii°
    describe('Altered (7th mode)', () => {
      it('i° → Diminished Triad', () => {
        expect(getQualityForDegree('i°', 'Altered')).toBe('Diminished Triad');
      });

      it('ii → Minor Triad', () => {
        expect(getQualityForDegree('ii', 'Altered')).toBe('Minor Triad');
      });

      it('iii → Minor Triad', () => {
        expect(getQualityForDegree('iii', 'Altered')).toBe('Minor Triad');
      });

      it('IV+ → Major Triad (augmented collapses to Major)', () => {
        expect(getQualityForDegree('IV+', 'Altered')).toBe('Major Triad');
      });

      it('V → Major Triad', () => {
        expect(getQualityForDegree('V', 'Altered')).toBe('Major Triad');
      });

      it('VI → Major Triad', () => {
        expect(getQualityForDegree('VI', 'Altered')).toBe('Major Triad');
      });

      it('vii° → Diminished Triad', () => {
        expect(getQualityForDegree('vii°', 'Altered')).toBe('Diminished Triad');
      });
    });
  });
});

describe('getAdjacentDegree', () => {
  describe('Major scale — forward step', () => {
    it('I + direction(+1) → ii', () => {
      expect(getAdjacentDegree('I', 'Major', 1)).toBe('ii');
    });

    it('vi + direction(+1) → vii°', () => {
      expect(getAdjacentDegree('vi', 'Major', 1)).toBe('vii°');
    });

    it('vii° + direction(+1) wraps to I', () => {
      expect(getAdjacentDegree('vii°', 'Major', 1)).toBe('I');
    });
  });

  describe('Major scale — backward step', () => {
    it('ii + direction(-1) → I', () => {
      expect(getAdjacentDegree('ii', 'Major', -1)).toBe('I');
    });

    it('I + direction(-1) wraps to vii°', () => {
      expect(getAdjacentDegree('I', 'Major', -1)).toBe('vii°');
    });
  });

  describe('Natural Minor scale — forward step', () => {
    it('i + direction(+1) → ii°', () => {
      expect(getAdjacentDegree('i', 'Natural Minor', 1)).toBe('ii°');
    });

    it('VII (last degree) + direction(+1) wraps to i', () => {
      expect(getAdjacentDegree('VII', 'Natural Minor', 1)).toBe('i');
    });
  });

  describe('Null input — returns first degree regardless of direction', () => {
    it('null + direction(+1) → first degree of Major ("I")', () => {
      expect(getAdjacentDegree(null, 'Major', 1)).toBe('I');
    });

    it('null + direction(-1) → first degree of Major ("I")', () => {
      expect(getAdjacentDegree(null, 'Major', -1)).toBe('I');
    });
  });

  describe('Unknown degree falls back gracefully', () => {
    it('"IX" (nonexistent) + direction(+1) on Major → returns "I" (first degree)', () => {
      expect(getAdjacentDegree('IX', 'Major', 1)).toBe('I');
    });
  });
});

describe('remapDegreeForScale', () => {
  it('same scale → returns input unchanged', () => {
    expect(remapDegreeForScale('I', 'Major', 'Major')).toBe('I');
    expect(remapDegreeForScale('vii°', 'Major', 'Major')).toBe('vii°');
  });

  it('Major → Dorian: I (semitone 0, Major Triad) → i (semitone 0, Minor Triad)', () => {
    expect(remapDegreeForScale('I', 'Major', 'Dorian')).toBe('i');
  });

  it('Major → Mixolydian: V (semitone 7, Major Triad) → v (semitone 7, Minor Triad)', () => {
    expect(remapDegreeForScale('V', 'Major', 'Mixolydian')).toBe('v');
  });

  it('Major → Lydian: V (semitone 7) → V (semitone 7) — both Major Triad', () => {
    expect(remapDegreeForScale('V', 'Major', 'Lydian')).toBe('V');
  });

  it('Dorian → Major: i (semitone 0) → I (semitone 0)', () => {
    expect(remapDegreeForScale('i', 'Dorian', 'Major')).toBe('I');
  });

  it('Major → Phrygian: ii (semitone 2) → null (Phrygian has no degree at semitone 2; II at semitone 1 instead)', () => {
    // Major's ii is at semitone 2; Phrygian's degrees are at 0,1,3,5,7,8,10. No degree at semitone 2.
    expect(remapDegreeForScale('ii', 'Major', 'Phrygian')).toBeNull();
  });

  it('unknown degree → null', () => {
    expect(remapDegreeForScale('IX', 'Major', 'Dorian')).toBeNull();
  });

  it('Major → Natural Minor: vi (semitone 9) → null (Natural Minor has no degree at semitone 9)', () => {
    // Major's vi sits on the 9th semitone above the tonic. Natural Minor's
    // sixth-degree triad is rooted on semitone 8 instead, so semitone 9 has
    // no diatonic degree to remap into.
    expect(remapDegreeForScale('vi', 'Major', 'Natural Minor')).toBeNull();
  });

  it('Major → Harmonic Minor: V (semitone 7) → V (semitone 7) — both Major Triad', () => {
    // Harmonic Minor's V is intentionally raised — semitone 7 stays Major.
    expect(remapDegreeForScale('V', 'Major', 'Harmonic Minor')).toBe('V');
  });
});
