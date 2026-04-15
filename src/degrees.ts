import { SCALES } from "./theory";

// Scale degrees keyed by chromatic semitone interval from root
const MODE_DEGREES: Record<string, Record<number, string>> = {
  // Major modes
  'Major':           { 0: "I", 2: "ii", 4: "iii", 5: "IV", 7: "V", 9: "vi", 11: "vii°" },
  'Lydian':          { 0: "I", 2: "II", 4: "iii", 6: "iv°", 7: "V", 9: "vi", 11: "vii" },
  'Mixolydian':      { 0: "I", 2: "ii", 4: "iii°", 5: "IV", 7: "v", 9: "vi", 10: "VII" },
  // Minor modes
  'Natural Minor':   { 0: "i", 2: "ii°", 3: "III", 5: "iv", 7: "v", 8: "VI", 10: "VII" },
  'Dorian':          { 0: "i", 2: "ii", 3: "III", 5: "IV", 7: "v", 9: "vi°", 10: "VII" },
  'Phrygian':        { 0: "i", 1: "II", 3: "III", 5: "iv", 7: "v°", 8: "VI", 10: "vii" },
  'Locrian':         { 0: "i°", 1: "II", 3: "iii", 5: "iv", 6: "V", 8: "VI", 10: "vii" },
  'Harmonic Minor':  { 0: "i", 2: "ii°", 3: "III+", 5: "iv", 7: "V", 8: "VI", 11: "vii°" },
};

export const DEGREE_COLORS: Record<string, string> = {
  "I": "#f59e0b",   // amber - tonic
  "i": "#f59e0b",
  "i°": "#f59e0b",
  "II": "#3b82f6",  // blue - supertonic
  "ii": "#3b82f6",
  "ii°": "#3b82f6",
  "III": "#10b981",  // emerald - mediant
  "III+": "#10b981",
  "iii": "#10b981",
  "iii°": "#10b981",
  "IV": "#ef4444",   // red - subdominant
  "iv": "#ef4444",
  "iv°": "#ef4444",
  "V": "#8b5cf6",   // violet - dominant
  "v": "#8b5cf6",
  "v°": "#8b5cf6",
  "VI": "#ec4899",   // pink - submediant
  "vi": "#ec4899",
  "vi°": "#ec4899",
  "VII": "#6366f1",  // indigo - leading tone
  "vii": "#6366f1",
  "vii°": "#6366f1",
};

const MAJOR_BASE_DEGREES = ["I", "ii", "iii", "IV", "V", "vi", "vii°"] as const;
const MINOR_BASE_DEGREES = ["i", "ii°", "III", "iv", "v", "VI", "VII"] as const;

// Fallback: major-quality scales use Major degrees, minor-quality use Natural Minor
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
