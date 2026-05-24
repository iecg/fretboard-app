export const ALL_STRINGS: readonly number[] = [0, 1, 2, 3, 4, 5];

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

export const ALL_STRINGS_OPTION: StringSetOption = {
  id: "all",
  strings: ALL_STRINGS,
};

/**
 * For a chord requiring `voiceCount` notes on a 6-string instrument,
 * enumerates every consecutive-string window plus an "all" sentinel.
 * Returns options in top-to-bottom string order (high strings first).
 *
 * Voice counts outside [3, 5] collapse to just the "all" sentinel —
 * dyads and hexads don't carve into meaningful string-set windows.
 */
export function buildStringSetOptions(voiceCount: number): StringSetOption[] {
  if (voiceCount < 3 || voiceCount > 5) return [];
  const sets: StringSetOption[] = [];
  const windowCount = 6 - voiceCount + 1;
  for (let start = 0; start < windowCount; start += 1) {
    const strings: number[] = [];
    for (let i = 0; i < voiceCount; i += 1) strings.push(start + i);
    sets.push({ id: strings.join("-"), strings });
  }
  return sets;
}
