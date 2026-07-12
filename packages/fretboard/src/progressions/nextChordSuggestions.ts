import {
  getDegreesForScale,
  getDiatonicChord,
  type DegreeId,
} from "@fretflow/core";

/**
 * Function-aware next-chord suggestions for the progression editor.
 *
 * Theory grounding: the classical harmonic-function ladder (tonic →
 * pre-dominant → dominant → tonic) and its common exits — see
 * `docs/design/music-theory-pedagogy.md` §"Chord-function transitions".
 * The table is keyed by the previous chord root's SEMITONE OFFSET from the
 * tonic (the same key `getDegreesForScale` uses), which makes it
 * scale-agnostic: each candidate offset is only offered when the active
 * scale actually has a diatonic degree there, so modes and pentatonics get
 * mode-correct numerals and qualities for free.
 *
 * NOTE: like `progressionGeneration.ts`, this deliberately avoids
 * @tonaljs/progression (major-key-only roman-numeral frame); FretFlow's
 * degree tables are modal-aware.
 */

/** Why a candidate is suggested — rendered as a localized tooltip. */
export type NextChordReason =
  | "authenticCadence"
  | "plagalCadence"
  | "deceptiveCadence"
  | "twoFive"
  | "modalCadence"
  | "leadingResolve"
  | "toDominant"
  | "commonMove";

export interface NextChordSuggestion {
  degree: DegreeId;
  /** Sharps-form root of the diatonic chord (FretFlow contract). */
  root: string;
  /** FretFlow quality key of the diatonic chord (M / m / dim / aug). */
  quality: string;
  reason: NextChordReason;
}

/**
 * Ranked candidate root offsets per previous-chord root offset. Ordering is
 * the ranking; unavailable offsets (not diatonic to the active scale) are
 * skipped, letting later candidates surface.
 */
const NEXT_OFFSETS: Record<number, readonly number[]> = {
  0: [5, 7, 9, 8, 2, 3], // tonic → subdominant, dominant, submediant, pre-dominants
  1: [7, 0, 5], // ♭II (Neapolitan / phrygian) → dominant, tonic
  2: [7, 11, 5, 0], // supertonic → dominant (ii–V), leading tone, subdominant
  3: [8, 5, 7, 10], // ♭III → VI, iv, V (minor circle motion), ♭VII
  4: [9, 5, 2, 0], // mediant → vi, IV, ii (the major-key ladder)
  5: [7, 0, 2, 11], // subdominant → dominant, tonic (plagal), supertonic
  6: [7, 0, 5], // ♯IV/♭V → dominant, tonic
  7: [0, 9, 8, 5], // dominant → tonic (authentic), vi/VI (deceptive), IV
  8: [10, 7, 2, 5], // ♭VI → ♭VII (Aeolian ♭VI–♭VII–i), dominant, pre-dominants
  9: [2, 5, 7, 0], // submediant → ii, IV, V (circle / pop turnaround)
  10: [0, 3, 5, 7], // ♭VII (subtonic) → tonic (modal cadence), ♭III
  11: [0, 4, 2], // leading tone → tonic, mediant
};

/** No previous chord: open on the tonic, then the primary functions. */
const OPENING_OFFSETS: readonly number[] = [0, 5, 7, 2];

function reasonFor(from: number | null, to: number): NextChordReason {
  if (from == null) return "commonMove";
  if (from === 7 && to === 0) return "authenticCadence";
  if (from === 5 && to === 0) return "plagalCadence";
  if (from === 7 && (to === 9 || to === 8)) return "deceptiveCadence";
  if (from === 2 && to === 7) return "twoFive";
  if (from === 10 && to === 0) return "modalCadence";
  if (from === 11 && to === 0) return "leadingResolve";
  if (to === 7) return "toDominant";
  return "commonMove";
}

/**
 * Suggests up to `limit` plausible next chords after `previousDegree` in the
 * given key, ranked by chord-function convention. `previousDegree` may be
 * null (empty progression) or a degree the scale doesn't know (borrowed /
 * chromatic numerals cached on the step) — both fall back to the opening
 * candidates. Only diatonic degrees of the active scale are ever returned.
 */
export function suggestNextChords(
  previousDegree: string | null,
  scaleName: string,
  tonicNote: string,
  limit = 3,
): NextChordSuggestion[] {
  const degreesByOffset = getDegreesForScale(scaleName);

  let fromOffset: number | null = null;
  if (previousDegree != null) {
    for (const [offset, degree] of Object.entries(degreesByOffset)) {
      if (degree === previousDegree) {
        fromOffset = Number(offset);
        break;
      }
    }
  }

  const candidates =
    fromOffset != null ? NEXT_OFFSETS[fromOffset] ?? OPENING_OFFSETS : OPENING_OFFSETS;

  const suggestions: NextChordSuggestion[] = [];
  for (const offset of candidates) {
    const degree = degreesByOffset[offset];
    if (!degree) continue;
    const chord = getDiatonicChord(degree, scaleName, tonicNote);
    if (!chord) continue;
    suggestions.push({
      degree,
      root: chord.root,
      quality: chord.quality,
      reason: reasonFor(fromOffset, offset),
    });
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}
