/**
 * Adapter between FretFlow's verbose music-theory names and Tonal's symbol names.
 *
 * FretFlow chose verbose names ("Major Triad", "Natural Minor", "Major Pentatonic")
 * for user-facing clarity; Tonal uses compact symbols ("M", "minor", "major pentatonic").
 * Every cross-module call into Tonal passes through this file.
 */

import * as Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";

/**
 * App chord-quality name (e.g., "Major Triad") → Tonal chord symbol suffix
 * (e.g., "M"). Suffix is what Tonal.Chord.get() consumes after the root.
 */
const QUALITY_TO_TONAL: Record<string, string> = {
  "Major Triad": "M",
  "Minor Triad": "m",
  "Diminished Triad": "dim",
  "Augmented Triad": "aug",
  "Sus2": "sus2",
  "Sus4": "sus4",
  "Major 6th": "6",
  "Minor 6th": "m6",
  "Major 7th": "maj7",
  "Minor 7th": "m7",
  "Dominant 7th": "7",
  "Diminished 7th": "dim7",
  "Half-Diminished 7th": "m7b5",
  "Minor-Major 7th": "mMaj7",
  "Power Chord (5)": "5",
};

const TONAL_TO_QUALITY: Record<string, string> = Object.fromEntries(
  Object.entries(QUALITY_TO_TONAL).map(([app, tonal]) => [tonal, app]),
);

const SCALE_TO_TONAL: Record<string, string> = {
  "Major": "major",
  "Natural Minor": "minor",
  "Harmonic Minor": "harmonic minor",
  "Melodic Minor": "melodic minor",
  "Major Pentatonic": "major pentatonic",
  "Minor Pentatonic": "minor pentatonic",
  "Blues": "blues",
  "Ionian": "ionian",
  "Dorian": "dorian",
  "Phrygian": "phrygian",
  "Lydian": "lydian",
  "Mixolydian": "mixolydian",
  "Aeolian": "aeolian",
  "Locrian": "locrian",
  // Harmonic Minor modes
  "Locrian Natural 6": "locrian 6",
  "Ionian Augmented": "ionian augmented",
  "Dorian Sharp 4": "dorian #4",
  "Phrygian Dominant": "phrygian dominant",
  "Lydian Sharp 2": "lydian #9",
  "Altered Diminished": "ultralocrian",
  // Melodic Minor modes
  "Dorian Flat 2": "dorian b2",
  "Lydian Augmented": "lydian augmented",
  "Lydian Dominant": "lydian dominant",
  "Mixolydian Flat 6": "mixolydian b6",
  "Locrian Natural 2": "locrian #2",
  "Altered": "altered",
  // Blues variants
  "Minor Blues": "minor blues",
  "Major Blues": "major blues",
};

const TONAL_TO_SCALE: Record<string, string> = Object.fromEntries(
  Object.entries(SCALE_TO_TONAL).map(([app, tonal]) => [tonal, app]),
);

export function chordQualityToTonal(quality: string): string | undefined {
  return QUALITY_TO_TONAL[quality];
}

export function tonalToChordQuality(symbol: string): string | undefined {
  return TONAL_TO_QUALITY[symbol];
}

export function scaleNameToTonal(scaleName: string): string | undefined {
  return SCALE_TO_TONAL[scaleName];
}

export function tonalToScaleName(tonalName: string): string | undefined {
  return TONAL_TO_SCALE[tonalName];
}

/**
 * Return the canonical Tonal chord symbol for an (root, app-quality) pair, or
 * undefined if the quality is not a known FretFlow chord. Example: ("C", "Major Triad") → "CM".
 */
export function tonalChordSymbol(root: string, quality: string): string | undefined {
  const suffix = chordQualityToTonal(quality);
  return suffix === undefined ? undefined : `${root}${suffix}`;
}

/**
 * Transpose `note` by the interval from `oldRoot` to `newRoot`, returning the
 * result normalized to the FretFlow sharps-form contract (e.g. `Eb` → `D#`).
 *
 * Returns the input unchanged when `oldRoot === newRoot`, or when Tonal cannot
 * resolve the interval (e.g. malformed roots) — preserving the caller's intent
 * rather than mangling state on bad input.
 */
export function transposeNoteToSharps(
  note: string,
  oldRoot: string,
  newRoot: string,
): string {
  if (oldRoot === newRoot) return note;
  const interval = Interval.distance(oldRoot, newRoot);
  if (!interval) return note;
  const transposed = Note.transpose(note, interval);
  if (!transposed) return note;
  const simplified = Note.simplify(transposed);
  return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
}
