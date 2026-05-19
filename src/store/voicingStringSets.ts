/**
 * Dynamic String Set options for the Chord-tab voicing controls.
 *
 * A string set is either `all` (all six strings) or a contiguous window of
 * `N` strings, where `N` is the active chord's tone count. With six strings
 * there are `W = 6 - N + 1` windows, numbered bass → treble.
 *
 * String indices run 0 = high E … 5 = low E (matching `VoicingNote.stringIndex`).
 * Guitar string numbers are `index + 1`; the bass window includes string 6.
 */

export interface StringSetOption {
  /** Stable id: "all", or the guitar string numbers joined low→high, e.g. "4·5·6". */
  id: string;
  /** i18n key for the human label. */
  labelKey: string;
  /** Allowed string indices, ascending (0 = high E … 5 = low E). */
  strings: readonly number[];
}

const ALL_STRINGS: readonly number[] = [0, 1, 2, 3, 4, 5];

const ALL_OPTION: StringSetOption = {
  id: "all",
  labelKey: "inspector.stringSetAll",
  strings: ALL_STRINGS,
};

/**
 * Labels for the middle windows (all windows except Bass / Treble), keyed by
 * how many middle windows exist. Assigned symmetrically per the design spec.
 */
const MIDDLE_LABEL_KEYS: Record<number, readonly string[]> = {
  0: [],
  1: ["inspector.stringSetMiddle"],
  2: ["inspector.stringSetLowerMid", "inspector.stringSetUpperMid"],
  3: [
    "inspector.stringSetLowerMid",
    "inspector.stringSetMiddle",
    "inspector.stringSetUpperMid",
  ],
};

/**
 * Build the ordered String Set option list for a chord with `toneCount` tones.
 * Always starts with `All`, then the windows bass → treble. A chord with six
 * or more tones (or an unknown tone count) gets only `All`.
 */
export function buildStringSetOptions(toneCount: number): StringSetOption[] {
  const n = Math.floor(toneCount);
  if (n < 2 || n > 5) return [ALL_OPTION];

  const windowCount = 6 - n + 1;
  const middleKeys = MIDDLE_LABEL_KEYS[windowCount - 2] ?? [];

  const windows: StringSetOption[] = [];
  for (let w = 0; w < windowCount; w += 1) {
    // Window 0 (Bass) sits on the lowest-pitch strings (highest indices).
    const start = 6 - n - w;
    const strings: number[] = [];
    for (let s = start; s < start + n; s += 1) strings.push(s);

    const labelKey =
      w === 0
        ? "inspector.stringSetBass"
        : w === windowCount - 1
          ? "inspector.stringSetTreble"
          : middleKeys[w - 1] ?? "inspector.stringSetMiddle";

    // Id: guitar string numbers (index + 1), ascending, joined with "·".
    const id = strings.map((s) => s + 1).join("·");
    windows.push({ id, labelKey, strings });
  }

  return [ALL_OPTION, ...windows];
}
