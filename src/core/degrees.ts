import { SCALES } from "./theoryCatalog";

// Scale degrees by semitone interval from root
const MODE_DEGREES: Record<string, Record<number, string>> = {
  'Major':           { 0: "I", 2: "ii", 4: "iii", 5: "IV", 7: "V", 9: "vi", 11: "vii°" },
  'Lydian':          { 0: "I", 2: "II", 4: "iii", 6: "iv°", 7: "V", 9: "vi", 11: "vii" },
  'Mixolydian':      { 0: "I", 2: "ii", 4: "iii°", 5: "IV", 7: "v", 9: "vi", 10: "VII" },
  'Natural Minor':   { 0: "i", 2: "ii°", 3: "III", 5: "iv", 7: "v", 8: "VI", 10: "VII" },
  'Dorian':          { 0: "i", 2: "ii", 3: "III", 5: "IV", 7: "v", 9: "vi°", 10: "VII" },
  'Phrygian':        { 0: "i", 1: "II", 3: "III", 5: "iv", 7: "v°", 8: "VI", 10: "vii" },
  'Locrian':         { 0: "i°", 1: "II", 3: "iii", 5: "iv", 6: "V", 8: "VI", 10: "vii" },
  'Harmonic Minor':  { 0: "i", 2: "ii°", 3: "III+", 5: "iv", 7: "V", 8: "VI", 11: "vii°" },
};

export const DEGREE_COLORS: Record<string, string> = {
  "I": "#f59e0b",
  "i": "#f59e0b",
  "i°": "#f59e0b",
  "II": "#3b82f6",
  "ii": "#3b82f6",
  "ii°": "#3b82f6",
  "III": "#10b981",
  "III+": "#10b981",
  "iii": "#10b981",
  "iii°": "#10b981",
  "IV": "#ef4444",
  "iv": "#ef4444",
  "iv°": "#ef4444",
  "V": "#8b5cf6",
  "v": "#8b5cf6",
  "v°": "#8b5cf6",
  "VI": "#ec4899",
  "vi": "#ec4899",
  "vi°": "#ec4899",
  "VII": "#6366f1",
  "vii": "#6366f1",
  "vii°": "#6366f1",
};

const MAJOR_BASE_DEGREES = ["I", "ii", "iii", "IV", "V", "vi", "vii°"] as const;
const MINOR_BASE_DEGREES = ["i", "ii°", "III", "iv", "v", "VI", "VII"] as const;

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
 * @param degreeId - Roman numeral string (e.g., "I", "ii", "vii°")
 * @param scaleName - Scale name (e.g., "Major", "Natural Minor", "Harmonic Minor")
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
  // (e.g. Melodic Minor and its derived modes)
  const intervals = SCALES[scaleName];
  if (!intervals || intervals.length < 7) return undefined;

  const degreeIdx = intervals.indexOf(semitone);
  if (degreeIdx === -1) return undefined;

  // Interval from this degree to the note two scale steps above it
  const thirdInterval =
    ((intervals[(degreeIdx + 2) % 7] - semitone + 12) % 12);
  // Interval from this degree to the note four scale steps above it (the 5th)
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
  const degreesMap = getDegreesForScale(scaleName);
  const degreeList = Object.values(degreesMap);

  if (!degreeId || !degreeList.includes(degreeId)) {
    return degreeList[0];
  }

  const currentIndex = degreeList.indexOf(degreeId);
  const nextIndex = (currentIndex + direction + degreeList.length) % degreeList.length;
  return degreeList[nextIndex];
}

// Fallback: Major quality scales use Major degrees, minor quality use Natural Minor
export function getDegreesForScale(scaleName: string): Record<number, string> {
  if (MODE_DEGREES[scaleName]) return MODE_DEGREES[scaleName];
  const intervals = SCALES[scaleName];
  if (!intervals) return MODE_DEGREES["Natural Minor"];

  if (intervals.length === 7) {
    const baseDegrees = intervals.includes(4)
      ? MAJOR_BASE_DEGREES
      : MINOR_BASE_DEGREES;
    return Object.fromEntries(
      intervals.map((interval, index) => [interval, baseDegrees[index] ?? ""]),
    );
  }

  if (intervals.includes(4)) return MODE_DEGREES["Major"];
  return MODE_DEGREES["Natural Minor"];
}
