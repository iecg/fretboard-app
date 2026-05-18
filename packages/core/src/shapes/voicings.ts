import { NOTES, CHORD_DEFINITIONS } from "../theory";
import { parseNote } from "../guitar";
import type { CagedShape } from "./templates";

export type VoicingType = "caged" | "drop2" | "triad";
export type VoicingInversion = "root" | "1st" | "2nd" | "3rd";
export type VoicingStringSet = "all" | "low" | "mid" | "mid-hi" | "top";

export interface VoicingNote {
  /** 0 = highest string, 5 = lowest. */
  stringIndex: number;
  fretIndex: number;
  noteName: string;
  midi: number;
}

export interface Voicing {
  positionKeys: string[];
  notes: VoicingNote[];
  /** Present only for `caged` voicings; absent for algorithmic voicings. */
  shape?: CagedShape;
}

/** Allowed string indices (0 = high E … 5 = low E) for each string set. */
const STRING_SET_MASKS: Record<VoicingStringSet, number[]> = {
  all: [0, 1, 2, 3, 4, 5],
  low: [3, 4, 5],
  mid: [2, 3, 4],
  "mid-hi": [1, 2, 3],
  top: [0, 1, 2],
};

const INVERSION_INDEX: Record<VoicingInversion, number> = {
  root: 0,
  "1st": 1,
  "2nd": 2,
  "3rd": 3,
};

export function stringSetMask(set: VoicingStringSet): number[] {
  return [...STRING_SET_MASKS[set]];
}

/** MIDI number of an open string written like "E2" / "A#3". null if unparseable. */
export function openStringMidi(openString: string): number | null {
  const parsed = parseNote(openString);
  if (!parsed) return null;
  const idx = NOTES.indexOf(parsed.noteName);
  if (idx < 0) return null;
  return parsed.octave * 12 + idx;
}

/**
 * Pitch class (0-11) of the note that must be the lowest voice for `inversion`.
 * null when the chord has no member at that inversion index (e.g. 3rd on a triad).
 */
export function inversionBassPitchClass(
  chordRoot: string,
  chordType: string,
  inversion: VoicingInversion,
): number | null {
  const def = CHORD_DEFINITIONS[chordType];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (!def || rootIndex < 0) return null;
  const memberIndex = INVERSION_INDEX[inversion];
  const member = def.members[memberIndex];
  if (!member) return null;
  return (rootIndex + member.semitone) % 12;
}
