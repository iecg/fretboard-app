/**
 * Internal utility helpers built on top of Tonal modules. Provides:
 *
 * - `normalizeToSharps(note)` — coerce Tonal's mixed-spelling output
 *   to FretFlow's sharps-only contract.
 * - `transposeNoteToSharps(note, oldRoot, newRoot)` — transpose a note
 *   by the interval between two roots, returning a sharps-normalized name.
 * - `getScaleSemitonesFromTonal(name)` / `getChordSemitonesFromTonal(symbol)` —
 *   source-of-truth interval extraction for FretFlow's SCALES + CHORD_DEFINITIONS.
 * - `getModeTriads(name)` — diatonic-triad Roman-numeral table per mode
 *   (Tonal's modal vocabulary translated to FretFlow's case+suffix conventions).
 * - `getChordDisplayLabel(symbol)` —
 *   user-facing English label derived from Tonal's chord name dictionary.
 */

import * as Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";
import * as Scale from "@tonaljs/scale";
import * as Chord from "@tonaljs/chord";
import * as Mode from "@tonaljs/mode";

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

