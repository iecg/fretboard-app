import { SCALES } from "./theoryCatalog";

/**
 * Opaque type alias for Roman-numeral scale degree identifiers.
 * Examples: "I", "ii", "iii", "IV", "V", "vi", "vii°", "III+"
 */
export type DegreeId = string;

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;

/**
 * Returns the Roman-numeral label for a single diatonic triad given its
 * scale-step position (1–7) and the third/fifth intervals from the step root.
 *
 * Casing + suffix encodes triad quality:
 *   - Major (4, 7)       → "I"
 *   - Minor (3, 7)       → "i"
 *   - Diminished (3, 6)  → "i°"
 *   - Augmented (4, 8)   → "I+"
 * Exotic intervals fall back to numeral case based on the third (minor third → lowercase).
 */
function buildDegreeLabel(
  position: number,
  thirdSemitones: number,
  fifthSemitones: number,
): string {
  const numeral = ROMAN_NUMERALS[position];
  if (thirdSemitones === 4 && fifthSemitones === 8) return `${numeral}+`;
  if (thirdSemitones === 4 && fifthSemitones === 7) return numeral;
  if (thirdSemitones === 3 && fifthSemitones === 7) return numeral.toLowerCase();
  if (thirdSemitones === 3 && fifthSemitones === 6) return `${numeral.toLowerCase()}°`;
  return thirdSemitones === 3 ? numeral.toLowerCase() : numeral;
}

/**
 * Computes a degree map (semitone offset → Roman numeral) for a 7-note scale
 * by stacking diatonic thirds on each scale step. Returns an empty object for
 * non-7-note scales.
 */
function buildDegreesFromIntervals(intervals: number[]): Record<number, string> {
  const result: Record<number, string> = {};
  if (intervals.length !== 7) return result;
  for (let i = 0; i < 7; i++) {
    const root = intervals[i];
    const third = (intervals[(i + 2) % 7] - root + 12) % 12;
    const fifth = (intervals[(i + 4) % 7] - root + 12) % 12;
    result[root] = buildDegreeLabel(i, third, fifth);
  }
  return result;
}

// Pre-computed degree maps for the canonical 7-note scales.
// Mirrors what buildDegreesFromIntervals returns; kept as a fast-path
// and as documentation of expected output for the named modes.
const MODE_DEGREES: Record<string, Record<number, string>> = {
  Major:           { 0: "I",  2: "ii", 4: "iii",  5: "IV", 7: "V", 9: "vi", 11: "vii°" },
  Lydian:          { 0: "I",  2: "II", 4: "iii",  6: "iv°", 7: "V", 9: "vi", 11: "vii" },
  Mixolydian:      { 0: "I",  2: "ii", 4: "iii°", 5: "IV", 7: "v", 9: "vi", 10: "VII" },
  "Natural Minor": { 0: "i",  2: "ii°", 3: "III", 5: "iv", 7: "v", 8: "VI", 10: "VII" },
  Dorian:          { 0: "i",  2: "ii", 3: "III",  5: "IV", 7: "v", 9: "vi°", 10: "VII" },
  Phrygian:        { 0: "i",  1: "II", 3: "III",  5: "iv", 7: "v°", 8: "VI", 10: "vii" },
  Locrian:         { 0: "i°", 1: "II", 3: "iii",  5: "iv", 6: "V", 8: "VI", 10: "vii" },
  "Harmonic Minor":{ 0: "i",  2: "ii°", 3: "III+", 5: "iv", 7: "V", 8: "VI", 11: "vii°" },
};

export const BLUE_NOTE_COLOR = "#0047ff";

export const DEGREE_COLORS: Record<string, string> = {
  "I": "#ff7f00",
  "I+": "#ff7f00",
  "i": "#ff7f00",
  "i°": "#ff7f00",
  "II": "#377eb8",
  "II+": "#377eb8",
  "ii": "#377eb8",
  "ii°": "#377eb8",
  "III": "#4daf4a",
  "III+": "#4daf4a",
  "iii": "#4daf4a",
  "iii°": "#4daf4a",
  "IV": "#e41a1c",
  "IV+": "#e41a1c",
  "iv": "#e41a1c",
  "iv°": "#e41a1c",
  "V": "#7e22ce",
  "V+": "#7e22ce",
  "v": "#7e22ce",
  "v°": "#7e22ce",
  "VI": "#fdd835",
  "VI+": "#fdd835",
  "vi": "#fdd835",
  "vi°": "#fdd835",
  "VII": "#00c2ff",
  "VII+": "#00c2ff",
  "vii": "#00c2ff",
  "vii°": "#00c2ff",
  "b3": BLUE_NOTE_COLOR,
  "b5": BLUE_NOTE_COLOR,
};

// Diatonic triad quality for each scale degree (semitone offset → chord-name key).
// Covers the 8 scales explicitly listed in MODE_DEGREES.
const DEGREE_DIATONIC_QUALITY: Record<string, Record<number, string>> = {
  'Major':          { 0: "Major Triad", 2: "Minor Triad", 4: "Minor Triad", 5: "Major Triad", 7: "Major Triad", 9: "Minor Triad", 11: "Diminished Triad" },
  'Natural Minor':  { 0: "Minor Triad", 2: "Diminished Triad", 3: "Major Triad", 5: "Minor Triad", 7: "Minor Triad", 8: "Major Triad", 10: "Major Triad" },
  'Dorian':         { 0: "Minor Triad", 2: "Minor Triad", 3: "Major Triad", 5: "Major Triad", 7: "Minor Triad", 9: "Diminished Triad", 10: "Major Triad" },
  'Phrygian':       { 0: "Minor Triad", 1: "Major Triad", 3: "Major Triad", 5: "Minor Triad", 7: "Diminished Triad", 8: "Major Triad", 10: "Minor Triad" },
  'Lydian':         { 0: "Major Triad", 2: "Major Triad", 4: "Minor Triad", 6: "Diminished Triad", 7: "Major Triad", 9: "Minor Triad", 11: "Minor Triad" },
  'Mixolydian':     { 0: "Major Triad", 2: "Minor Triad", 4: "Diminished Triad", 5: "Major Triad", 7: "Minor Triad", 9: "Minor Triad", 10: "Major Triad" },
  'Locrian':        { 0: "Diminished Triad", 1: "Major Triad", 3: "Minor Triad", 5: "Minor Triad", 6: "Major Triad", 8: "Major Triad", 10: "Minor Triad" },
  'Harmonic Minor': { 0: "Minor Triad", 2: "Diminished Triad", 3: "Major Triad", 5: "Minor Triad", 7: "Major Triad", 8: "Major Triad", 11: "Diminished Triad" },
};

/**
 * Returns the diatonic triad quality (chord-name key) for a given scale degree.
 *
 * @param degreeId - Roman numeral string (e.g., "I", "ii", "vii°", "III+")
 * @param scaleName - Scale name (e.g., "Major", "Natural Minor", "Melodic Minor")
 * @returns The chord-name key (e.g., "Major Triad", "Minor Triad", "Diminished Triad"),
 *          or undefined if the scale or degree is not recognised.
 */
export function getQualityForDegree(
  degreeId: string,
  scaleName: string,
): string | undefined {
  const degreesMap = getDegreesForScale(scaleName);

  // Find the semitone offset whose Roman numeral value matches degreeId
  const semitoneEntry = Object.entries(degreesMap).find(
    ([, roman]) => roman === degreeId,
  );
  if (!semitoneEntry) return undefined;
  const semitone = Number(semitoneEntry[0]);

  // Table-backed scales
  if (DEGREE_DIATONIC_QUALITY[scaleName]) {
    return DEGREE_DIATONIC_QUALITY[scaleName][semitone];
  }

  // Algorithmic fallback for 7-note scales not in DEGREE_DIATONIC_QUALITY
  // (e.g. Melodic Minor and its derived modes, harmonic-minor non-tonic modes).
  // CHORD_DEFINITIONS has no Augmented Triad, so augmented degrees collapse to
  // Major Triad here (pragmatic — the visible chord overlay drops the #5).
  const intervals = SCALES[scaleName];
  if (!intervals || intervals.length !== 7) return undefined;

  const degreeIdx = intervals.indexOf(semitone);
  if (degreeIdx === -1) return undefined;

  const thirdInterval =
    ((intervals[(degreeIdx + 2) % 7] - semitone + 12) % 12);
  const fifthInterval =
    ((intervals[(degreeIdx + 4) % 7] - semitone + 12) % 12);

  if (thirdInterval === 3 && fifthInterval === 6) return "Diminished Triad";
  if (thirdInterval === 3) return "Minor Triad";
  if (thirdInterval === 4) return "Major Triad";
  return undefined;
}

/**
 * Returns the adjacent degree in the given scale, wrapping around at boundaries.
 *
 * Step semantics: vii° + direction(+1) wraps to I; I + direction(-1) wraps to vii°.
 * Null input: returns the first degree of the scale (activates overlay at sensible default).
 *
 * @param degreeId  Current Roman numeral (e.g. "I", "ii", "vii°") or null when overlay is off.
 * @param scaleName Scale name (e.g. "Major", "Natural Minor").
 * @param direction +1 for next, -1 for previous.
 * @returns Adjacent DegreeId string, wrapping at boundaries.
 */
export function getAdjacentDegree(
  degreeId: string | null,
  scaleName: string,
  direction: -1 | 1,
): string {
  const degreeList = getDegreeSequence(scaleName);

  if (!degreeId || !degreeList.includes(degreeId)) {
    return degreeList[0];
  }

  const currentIndex = degreeList.indexOf(degreeId);
  const nextIndex = (currentIndex + direction + degreeList.length) % degreeList.length;
  return degreeList[nextIndex];
}

/**
 * Returns an ordered array of DegreeIds for the given scale, sorted ascending by semitone.
 * Safer than Object.values(getDegreesForScale(...)) which relies on JS integer-key ordering.
 *
 * @param scaleName - Scale name (e.g., "Major", "Natural Minor").
 * @returns Ordered array of DegreeIds from lowest semitone to highest (e.g. ["I","ii","iii","IV","V","vi","vii°"]).
 */
export function getDegreeSequence(scaleName: string): DegreeId[] {
  const map = getDegreesForScale(scaleName);
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, degree]) => degree as DegreeId);
}

/**
 * Returns the diatonic-degree Roman-numeral map for the named scale.
 *
 * For 7-note scales, Roman numerals are computed from the actual diatonic triad
 * built on each scale step (third + fifth intervals → quality → casing/suffix).
 * For non-7-note scales (pentatonic, blues), falls back to the closest 7-note
 * template based on whether interval 4 is present — pragmatic, since true
 * diatonic-triad theory does not apply to scales with fewer than 7 notes.
 */
export function getDegreesForScale(scaleName: string): Record<number, string> {
  if (MODE_DEGREES[scaleName]) return MODE_DEGREES[scaleName];
  const intervals = SCALES[scaleName];
  if (!intervals) return MODE_DEGREES["Natural Minor"];

  if (intervals.length === 7) {
    return buildDegreesFromIntervals(intervals);
  }

  if (intervals.includes(4)) return MODE_DEGREES["Major"];
  return MODE_DEGREES["Natural Minor"];
}
