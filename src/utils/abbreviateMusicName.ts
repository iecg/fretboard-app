/**
 * Compact display abbreviations for scale and chord names shown on the inline
 * lens strip, where horizontal space is tight. Whole words are matched
 * case-insensitively; an empty replacement drops the word entirely.
 *
 * Examples:
 *   "C Major Triad"     -> "C Maj"
 *   "C Natural Minor"   -> "C Nat Min"
 *   "G Dominant 7th"    -> "G Dom 7th"
 *   "C Melodic Minor"   -> "C Mel Min"
 */
const ABBREVIATIONS: Record<string, string> = {
  major: "Maj",
  minor: "Min",
  dominant: "Dom",
  diminished: "Dim",
  augmented: "Aug",
  pentatonic: "Pent",
  natural: "Nat",
  harmonic: "Harm",
  melodic: "Mel",
  suspended: "Sus",
  triad: "",
};

export function abbreviateMusicName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => {
      const replacement = ABBREVIATIONS[word.toLowerCase()];
      return replacement === undefined ? word : replacement;
    })
    .filter((word) => word.length > 0)
    .join(" ")
    .trim();
}
