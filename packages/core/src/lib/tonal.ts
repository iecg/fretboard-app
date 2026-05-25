/**
 * Adapter between FretFlow's verbose music-theory names and Tonal's symbol names.
 *
 * FretFlow chose verbose names ("Major Triad", "minor", "major pentatonic")
 * for user-facing clarity; Tonal uses compact symbols ("M", "minor", "major pentatonic").
 * Every cross-module call into Tonal passes through this file.
 */

import * as Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";
import * as Scale from "@tonaljs/scale";
import * as Chord from "@tonaljs/chord";
import * as Mode from "@tonaljs/mode";

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
  "major": "major",
  "minor": "minor",
  "harmonic minor": "harmonic minor",
  "melodic minor": "melodic minor",
  "major pentatonic": "major pentatonic",
  "minor pentatonic": "minor pentatonic",
  "blues": "blues",
  "ionian": "ionian",
  "dorian": "dorian",
  "phrygian": "phrygian",
  "lydian": "lydian",
  "mixolydian": "mixolydian",
  "aeolian": "aeolian",
  "locrian": "locrian",
  // Harmonic Minor modes
  "locrian 6": "locrian 6",
  "ionian augmented": "ionian augmented",
  "dorian #4": "dorian #4",
  "phrygian dominant": "phrygian dominant",
  "lydian #9": "lydian #9",
  "ultralocrian": "ultralocrian",
  // Melodic Minor modes
  "dorian b2": "dorian b2",
  "lydian augmented": "lydian augmented",
  "lydian dominant": "lydian dominant",
  "mixolydian b6": "mixolydian b6",
  "locrian #2": "locrian #2",
  "altered": "altered",
  // Blues variants
  "minor blues": "minor blues",
  "major blues": "major blues",
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
  return normalizeToSharps(transposed);
}

/**
 * Normalize a Tonal note name to FretFlow's sharps-form contract.
 * Tonal may return flats (e.g. "Eb"); the rest of the app keys on the
 * sharps array (NOTES). Pass any Tonal-output note name through this
 * before exposing it.
 *
 * Returns the input unchanged when Tonal can't simplify it, preserving
 * the caller's intent on malformed input.
 */
export function normalizeToSharps(note: string): string {
  if (!note) return note;
  const simplified = Note.simplify(note);
  if (!simplified) return note;
  return simplified.includes("b") ? Note.enharmonic(simplified) : simplified;
}

/**
 * Returns the semitone offsets (0-11) of a scale, derived from Tonal.
 * Used as the source of truth for FretFlow's interval data in
 * SCALES (theoryCatalog.ts) and downstream consumers.
 *
 * Returns an empty array if the scale name isn't recognized — callers
 * must treat empty as a hard error during catalog construction (every
 * FretFlow scale must resolve).
 */
export function getScaleSemitonesFromTonal(scaleName: string): number[] {
  const tonalScale = Scale.get(`C ${scaleName}`);
  if (tonalScale.empty) return [];
  return tonalScale.notes
    .map((n) => Note.chroma(n))
    .filter((c): c is number => typeof c === "number" && !isNaN(c));
}

/**
 * Returns the semitone offsets (0-11) of a chord's intervals, derived
 * from Tonal. Used as the source of truth for FretFlow's chord-tone
 * positions in CHORD_DEFINITIONS (theory.ts).
 *
 * The order matches Tonal's interval array (root first, then ascending);
 * callers map this positionally onto members[].name, which stays
 * hand-coded as the chord-tone-overlay contract.
 *
 * Returns an empty array if the chord symbol isn't recognized.
 */
export function getChordSemitonesFromTonal(chordSymbol: string): number[] {
  const tonalChord = Chord.get(`C${chordSymbol}`);
  if (tonalChord.empty) return [];
  return tonalChord.intervals
    .map((iv) => Interval.semitones(iv))
    .filter((s): s is number => typeof s === "number" && !isNaN(s))
    .map((s) => ((s % 12) + 12) % 12);
}

/**
 * Roman numerals for scale-degrees 1..7. Used to translate Tonal's
 * triad-suffix output (e.g. ["", "m", "m", "", "", "m", "dim"]) into
 * FretFlow's roman-numeral degree-quality strings (e.g. "I", "ii", "vii°").
 */
const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;

/**
 * Translate one Tonal triad-suffix into a FretFlow roman-numeral degree string.
 *
 * Tonal's `Mode.triads(name)` returns suffixes:
 *   "" = major, "m" = minor, "dim" = diminished, "aug" = augmented.
 *
 * FretFlow's degree-string contract:
 *   Major → uppercase roman ("I"),
 *   Minor → lowercase roman ("ii"),
 *   Diminished → lowercase + "°" ("vii°"),
 *   Augmented → uppercase + "+" ("III+").
 */
function triadSuffixToRoman(suffix: string, step: number): string {
  const roman = ROMAN_NUMERALS[step];
  switch (suffix) {
    case "":
      return roman;
    case "m":
      return roman.toLowerCase();
    case "dim":
      return `${roman.toLowerCase()}°`;
    case "aug":
      return `${roman}+`;
    default:
      throw new Error(`triadSuffixToRoman: unknown suffix "${suffix}"`);
  }
}

/**
 * Returns the diatonic triad qualities of a mode as Roman-numeral
 * strings (e.g. ["i", "ii°", "III+", ...]). Tonal models the 7 standard
 * diatonic modes (ionian/major, dorian, phrygian, lydian, mixolydian,
 * aeolian/minor, locrian). Other FretFlow scales (pentatonics, blues,
 * harmonic/melodic minor and their modes) return null and must use
 * FretFlow's hand-coded tables.
 *
 * Tonal's `Mode.triads(name)` returns chord-quality suffixes
 * (`["", "m", "m", "", "", "m", "dim"]` for ionian), not romans —
 * we translate to FretFlow's format via {@link triadSuffixToRoman}.
 */
export function getModeTriads(modeName: string): readonly string[] | null {
  const mode = Mode.get(modeName);
  if (mode.empty) return null;
  let suffixes: string[];
  try {
    suffixes = Mode.triads(modeName, "");
  } catch {
    return null;
  }
  if (!suffixes || suffixes.length !== 7) return null;
  try {
    return suffixes.map((s, i) => triadSuffixToRoman(s, i));
  } catch {
    return null;
  }
}

/**
 * Returns the English display label for a Tonal chord symbol, suitable
 * for rendering in user-facing UI. Examples:
 *   getChordDisplayLabel("M")    -> "major"
 *   getChordDisplayLabel("m7")   -> "minor seventh"
 *   getChordDisplayLabel("dim7") -> "diminished seventh"
 *   getChordDisplayLabel("5")    -> "fifth"
 *
 * Returns the input unchanged if Tonal can't resolve it (defensive
 * fallback so the UI never shows blank).
 */
export function getChordDisplayLabel(chordSymbol: string): string {
  if (!chordSymbol) return chordSymbol;
  const c = Chord.get(`C${chordSymbol}`);
  if (c.empty) return chordSymbol;
  // Tonal returns names like "C major" or "C minor seventh"; strip the tonic.
  return c.name.replace(/^C\s*/, "").trim() || chordSymbol;
}

/**
 * Returns the English display label for a Tonal scale name, suitable
 * for rendering in user-facing UI. Examples:
 *   getScaleDisplayLabel("major")              -> "major"
 *   getScaleDisplayLabel("phrygian dominant")  -> "phrygian dominant"
 *   getScaleDisplayLabel("locrian 6")          -> "locrian 6"
 *
 * Returns the input unchanged if Tonal can't resolve it.
 */
export function getScaleDisplayLabel(scaleName: string): string {
  if (!scaleName) return scaleName;
  const s = Scale.get(`C ${scaleName}`);
  if (s.empty) return scaleName;
  return s.name.replace(/^C\s*/, "").trim() || scaleName;
}
