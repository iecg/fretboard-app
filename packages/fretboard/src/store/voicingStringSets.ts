export interface StringSetOption {
  /** Stable identifier — "all" or "0-1-2-3" style. */
  id: string;
  /** String indices (0 = high E, 5 = low E in standard tuning). */
  strings: readonly number[];
  /** When true, no voicing fits this string set in the active scale window. */
  disabled?: boolean;
  /** Human-readable reason shown when the option is disabled. */
  disabledReason?: string;
}

// ALL_STRINGS_OPTION is intentionally not exported — no external consumers
// remain after the stringSetOptionsAtom no-chord branch was updated to return []
// and effectiveStringSetAtom became voicing-mode-aware (full mode always returns all 6 strings).

/**
 * For a chord requiring `voiceCount` notes on a 6-string instrument,
 * enumerates every consecutive-string window. Returns options in
 * top-to-bottom string order (high strings first).
 *
 * Supports dyads (power chords, 2) through pentads (5). Voice counts
 * outside [2, 5] return no windows; the no-options case is handled
 * upstream by effectiveStringSetAtom / stringSetOptionsAtom.
 */
export function buildStringSetOptions(voiceCount: number): StringSetOption[] {
  if (voiceCount < 2 || voiceCount > 5) return [];
  const sets: StringSetOption[] = [];
  const windowCount = 6 - voiceCount + 1;
  for (let start = 0; start < windowCount; start += 1) {
    const strings: number[] = [];
    for (let i = 0; i < voiceCount; i += 1) strings.push(start + i);
    sets.push({ id: strings.join("-"), strings });
  }
  return sets;
}
