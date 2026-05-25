import { SCALES } from "./theoryCatalog";
import { getModeTriads } from "./lib/tonal";
import * as Key from "@tonaljs/key";

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

/**
 * Diatonic-degree maps per scale. Built by deriving Tonal triads for
 * the 7 standard modes; Harmonic Minor is kept hand-coded because
 * Tonal's harmonic-minor model uses different naming conventions and
 * FretFlow's table has been stable.
 */
function buildModeDegrees(scaleName: string): Record<number, string> {
  const triads = getModeTriads(scaleName);
  const semitones = SCALES[scaleName];
  if (!triads || !semitones || triads.length !== semitones.length) {
    throw new Error(
      `buildModeDegrees: ${scaleName} not derivable from Tonal (triads=${triads?.length}, semitones=${semitones?.length})`,
    );
  }
  const result: Record<number, string> = {};
  for (let i = 0; i < semitones.length; i++) {
    result[semitones[i]] = triads[i];
  }
  return result;
}

const MODE_DEGREES: Record<string, Record<number, string>> = {
  major:            buildModeDegrees("major"),
  lydian:           buildModeDegrees("lydian"),
  mixolydian:       buildModeDegrees("mixolydian"),
  minor:            buildModeDegrees("minor"),
  dorian:           buildModeDegrees("dorian"),
  phrygian:         buildModeDegrees("phrygian"),
  locrian:          buildModeDegrees("locrian"),
  // Harmonic Minor stays hand-coded — Tonal models it with different
  // suffix conventions and the table below has been stable.
  "harmonic minor": { 0: "i",  2: "ii°", 3: "III+", 5: "iv", 7: "V", 8: "VI", 11: "vii°" },
};

const PENTATONIC_DEGREES: Record<string, Record<number, string>> = {
  "major pentatonic": { 0: "I", 2: "ii", 4: "iii", 7: "V", 9: "vi" },
  "minor pentatonic": { 0: "i", 3: "III", 5: "iv", 7: "v", 10: "VII" },
};

const BLUES_DEGREES: Record<string, Record<number, string>> = {
  "major blues": PENTATONIC_DEGREES["major pentatonic"],
  "minor blues": PENTATONIC_DEGREES["minor pentatonic"],
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
  "VII": "#f781bf",
  "VII+": "#f781bf",
  "vii": "#f781bf",
  "vii°": "#f781bf",
  "b3": BLUE_NOTE_COLOR,
  "b5": BLUE_NOTE_COLOR,
};

// Diatonic triad quality for each scale degree (semitone offset → chord-name key).
// Covers the 8 scales explicitly listed in MODE_DEGREES.
const DEGREE_DIATONIC_QUALITY: Record<string, Record<number, string>> = {
  'major':            { 0: "M", 2: "m", 4: "m", 5: "M", 7: "M", 9: "m", 11: "dim" },
  'minor':            { 0: "m", 2: "dim", 3: "M", 5: "m", 7: "m", 8: "M", 10: "M" },
  'dorian':           { 0: "m", 2: "m", 3: "M", 5: "M", 7: "m", 9: "dim", 10: "M" },
  'phrygian':         { 0: "m", 1: "M", 3: "M", 5: "m", 7: "dim", 8: "M", 10: "m" },
  'lydian':           { 0: "M", 2: "M", 4: "m", 6: "dim", 7: "M", 9: "m", 11: "m" },
  'mixolydian':       { 0: "M", 2: "m", 4: "dim", 5: "M", 7: "m", 9: "m", 10: "M" },
  'locrian':          { 0: "dim", 1: "M", 3: "m", 5: "m", 6: "M", 8: "M", 10: "m" },
  'harmonic minor':   { 0: "m", 2: "dim", 3: "M", 5: "m", 7: "M", 8: "M", 11: "dim" },
  'major pentatonic': { 0: "M", 2: "m", 4: "m", 7: "M", 9: "m" },
  'minor pentatonic': { 0: "m", 3: "M", 5: "m", 7: "m", 10: "M" },
  'major blues':      { 0: "M", 2: "m", 4: "m", 7: "M", 9: "m" },
  'minor blues':      { 0: "m", 3: "M", 5: "m", 7: "m", 10: "M" },
};

/**
 * Remaps a Roman-numeral degree across scales by semitone-equivalence.
 *
 * Example: "I" in Major (semitone 0 = Major Triad) maps to "i" in Dorian
 * (semitone 0 = Minor Triad). The same scale-step position can have a
 * different case + suffix in a different mode because the diatonic triad
 * quality differs.
 *
 * @param degreeId   Current Roman-numeral degree in `fromScale`.
 * @param fromScale  The scale the degree currently belongs to.
 * @param toScale    The new scale to remap into.
 * @returns The equivalent degree in `toScale`, or `null` if the source
 *          semitone has no diatonic degree in the target scale (e.g. a
 *          chromatic-step degree that doesn't survive the mode change).
 *          Returns the input unchanged when `fromScale === toScale`.
 */
export function remapDegreeForScale(
  degreeId: string,
  fromScale: string,
  toScale: string,
): string | null {
  if (fromScale === toScale) return degreeId;
  const fromMap = getDegreesForScale(fromScale);
  const semitoneEntry = Object.entries(fromMap).find(
    ([, roman]) => roman === degreeId,
  );
  if (!semitoneEntry) return null;
  const semitone = Number(semitoneEntry[0]);
  const toMap = getDegreesForScale(toScale);
  return toMap[semitone] ?? null;
}

/**
 * Returns the diatonic triad quality (chord-name key) for a given scale degree.
 *
 * @param degreeId - Roman numeral string (e.g., "I", "ii", "vii°", "III+")
 * @param scaleName - Scale name (e.g., "Major", "minor", "melodic minor")
 * @returns The chord-name key (Tonal symbol, e.g. "M", "m", "dim"),
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
  // Augmented degrees collapse to "M" here (pragmatic — the visible chord
  // overlay drops the #5).
  const intervals = SCALES[scaleName];
  if (!intervals || intervals.length !== 7) return undefined;

  const degreeIdx = intervals.indexOf(semitone);
  if (degreeIdx === -1) return undefined;

  const thirdInterval =
    ((intervals[(degreeIdx + 2) % 7] - semitone + 12) % 12);
  const fifthInterval =
    ((intervals[(degreeIdx + 4) % 7] - semitone + 12) % 12);

  if (thirdInterval === 3 && fifthInterval === 6) return "dim";
  if (thirdInterval === 3) return "m";
  if (thirdInterval === 4) return "M";
  return undefined;
}

/**
 * Returns the adjacent degree in the given scale, wrapping around at boundaries.
 *
 * Step semantics: vii° + direction(+1) wraps to I; I + direction(-1) wraps to vii°.
 * Null input: returns the first degree of the scale (activates overlay at sensible default).
 *
 * @param degreeId  Current Roman numeral (e.g. "I", "ii", "vii°") or null when overlay is off.
 * @param scaleName Scale name (e.g. "Major", "minor").
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
 * @param scaleName - Scale name (e.g., "Major", "minor").
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
 *
 * **Non-7-note scale fallback:** Pentatonic uses explicit scale-step labels,
 * and blues uses the matching pentatonic degree set so blue notes remain color
 * tones rather than chord-degree choices. Other non-7-note scales cannot form
 * full diatonic triads on every step, so true degree analysis does not apply
 * there. They fall back to the closest 7-note parent map:
 *   - Major degrees when interval 4 (major 3rd) is present (major quality).
 *   - Natural Minor degrees otherwise (minor quality).
 *
 * Unknown or missing scales fall back to Natural Minor.
 */
export function getDegreesForScale(scaleName: string): Record<number, string> {
  if (MODE_DEGREES[scaleName]) return MODE_DEGREES[scaleName];
  if (PENTATONIC_DEGREES[scaleName]) return PENTATONIC_DEGREES[scaleName];
  if (BLUES_DEGREES[scaleName]) return BLUES_DEGREES[scaleName];
  const intervals = SCALES[scaleName];
  if (!intervals) return MODE_DEGREES["minor"];

  if (intervals.length === 7) {
    return buildDegreesFromIntervals(intervals);
  }

  if (intervals.includes(4)) return MODE_DEGREES["major"];
  return MODE_DEGREES["minor"];
}

/**
 * Extracts a quality symbol ("M", "m", "dim", "aug") from a Tonal triad chord
 * name by stripping the tonic note prefix.
 *
 * @internal
 */
function extractTriadQuality(chordName: string, tonicNote: string): string {
  const suffix = chordName.slice(tonicNote.length);
  if (suffix === "") return "M";
  if (suffix === "m") return "m";
  if (suffix === "dim") return "dim";
  if (suffix === "aug") return "aug";
  return suffix;
}

/**
 * Validates that the diatonic-chord-quality table for a given scale matches what
 * Tonal would produce. Used in tests to catch drift; not called in production.
 *
 * @internal
 */
export function _validateDiatonicQualitiesAgainstTonal(
  scaleName: string,
): boolean {
  if (scaleName === "major") {
    const key = Key.majorKey("C");
    const expectedTriadQualities = ["M", "m", "m", "M", "M", "m", "dim"];
    return key.triads.every(
      (triad, i) =>
        extractTriadQuality(triad, key.scale[i]) === expectedTriadQualities[i],
    );
  }
  if (scaleName === "minor") {
    const key = Key.minorKey("A");
    const expectedTriadQualities = ["m", "dim", "M", "m", "m", "M", "M"];
    return key.natural.triads.every(
      (triad, i) =>
        extractTriadQuality(triad, key.natural.scale[i]) ===
        expectedTriadQualities[i],
    );
  }
  return true;
}
