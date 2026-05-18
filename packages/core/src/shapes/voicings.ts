import { NOTES, CHORD_DEFINITIONS } from "../theory";
import { parseNote } from "../guitar";
import type { CagedShape } from "./templates";
import { getFullChordShapeMatches } from "./fullChordShapes";

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

export interface GenerateVoicingsParams {
  chordRoot: string;
  chordType: string;
  tuning: string[];
  maxFret: number;
  voicingType: VoicingType;
  inversion: VoicingInversion;
  stringSet: VoicingStringSet;
}

// Span limits tuned in Task 11 Step 5: triad raised 4→5 so close-position
// C-major triads (which span up to 5 frets across adjacent strings) survive.
const SPAN_LIMIT: Record<"triad" | "drop2", number> = { triad: 5, drop2: 5 };

/** Frets >0 only — open strings do not constrain the hand span. */
function fretSpan(notes: VoicingNote[]): number {
  const fretted = notes.map((n) => n.fretIndex).filter((f) => f > 0);
  if (fretted.length < 2) return 0;
  return Math.max(...fretted) - Math.min(...fretted);
}

/**
 * Algorithmic search for triad / drop2 voicings.
 * voiceCount: 3 for triad, 4 for drop2 (3 when a drop2 chord has <4 tones).
 *
 * Note: the drop2 pitch-span gate (`12 < span <= 24`, enabled via
 * `requireOctaveSpread`) is a heuristic approximation. It accepts any 4-note
 * voicing whose total span sits in the octave-plus range — it is NOT a true
 * drop-2 octave-displacement transform of a close-position voicing.
 */
function searchVoicings(
  params: GenerateVoicingsParams,
  voiceCount: number,
  requireOctaveSpread: boolean,
): Voicing[] {
  const { chordRoot, chordType, tuning, maxFret, inversion, stringSet, voicingType } = params;
  const def = CHORD_DEFINITIONS[chordType];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (!def || rootIndex < 0 || tuning.length !== 6) return [];

  const bassPC = inversionBassPitchClass(chordRoot, chordType, inversion);
  if (bassPC === null) return [];

  const chordPCs = def.members.map((m) => (rootIndex + m.semitone) % 12);
  const chordPCSet = new Set(chordPCs);
  const allowed = stringSetMask(stringSet);
  const spanLimit = SPAN_LIMIT[voicingType === "drop2" ? "drop2" : "triad"];

  const openMidis = tuning.map(openStringMidi);
  if (openMidis.some((m) => m === null)) return [];

  const candidateFrets: Record<number, number[]> = {};
  for (const s of allowed) {
    const open = openMidis[s] as number;
    const frets: number[] = [];
    for (let f = 0; f <= maxFret; f += 1) {
      if (chordPCSet.has((open + f) % 12)) frets.push(f);
    }
    candidateFrets[s] = frets;
  }

  const voicings: Voicing[] = [];
  const seen = new Set<string>();

  for (let i = 0; i + voiceCount <= allowed.length; i += 1) {
    const run = allowed.slice(i, i + voiceCount);
    const contiguous = run.every((v, k) => k === 0 || v === run[k - 1] + 1);
    if (!contiguous) continue;

    const dfs = (depth: number, picked: VoicingNote[]) => {
      if (depth === run.length) {
        const pcs = new Set(picked.map((n) => n.midi % 12));
        // Belt-and-suspenders: picked.length === voiceCount === chordPCSet.size,
        // so a size mismatch can only mean a duplicated pitch class.
        if (pcs.size !== chordPCSet.size) return;
        for (const pc of chordPCSet) if (!pcs.has(pc)) return;
        const lowest = picked.reduce((a, b) => (a.midi <= b.midi ? a : b));
        if (lowest.midi % 12 !== bassPC) return;
        if (fretSpan(picked) > spanLimit) return;
        const midis = picked.map((n) => n.midi);
        const pitchSpan = Math.max(...midis) - Math.min(...midis);
        if (requireOctaveSpread && !(pitchSpan > 12 && pitchSpan <= 24)) return;
        if (!requireOctaveSpread && pitchSpan > 12) return;
        const sorted = [...picked].sort((a, b) => a.stringIndex - b.stringIndex);
        const positionKeys = sorted.map((n) => `${n.stringIndex}-${n.fretIndex}`);
        const key = positionKeys.join("|");
        if (seen.has(key)) return;
        seen.add(key);
        voicings.push({ positionKeys, notes: sorted });
        return;
      }
      const stringIndex = run[depth];
      const open = openMidis[stringIndex] as number;
      for (const fret of candidateFrets[stringIndex]) {
        const midi = open + fret;
        dfs(depth + 1, [
          ...picked,
          { stringIndex, fretIndex: fret, noteName: NOTES[midi % 12], midi },
        ]);
      }
    };
    dfs(0, []);
  }
  return voicings;
}

export function generateVoicings(params: GenerateVoicingsParams): Voicing[] {
  const { voicingType } = params;
  if (voicingType === "caged") {
    return cagedVoicings(params);
  }
  const def = CHORD_DEFINITIONS[params.chordType];
  if (!def) return [];
  if (voicingType === "triad") {
    return searchVoicings(params, Math.min(3, def.members.length), false);
  }
  if (def.members.length >= 4) return searchVoicings(params, 4, true);
  return searchVoicings(params, Math.min(3, def.members.length), false);
}

function cagedVoicings(params: GenerateVoicingsParams): Voicing[] {
  const { chordRoot, chordType, tuning, maxFret, inversion, stringSet } = params;
  const allowed = new Set(stringSetMask(stringSet));
  const openMidis = tuning.map(openStringMidi);
  if (openMidis.some((m) => m === null)) return [];
  const bassPC = inversionBassPitchClass(chordRoot, chordType, inversion);

  const matches = getFullChordShapeMatches({ chordRoot, chordType, tuning, maxFret });
  const voicings: Voicing[] = [];
  for (const match of matches) {
    const notes: VoicingNote[] = match.notes.map((n) => ({
      stringIndex: n.stringIndex,
      fretIndex: n.fretIndex,
      noteName: n.noteName,
      midi: (openMidis[n.stringIndex] as number) + n.fretIndex,
    }));
    if (!notes.every((n) => allowed.has(n.stringIndex))) continue;
    if (inversion !== "root" && bassPC !== null) {
      const lowest = notes.reduce((a, b) => (a.midi <= b.midi ? a : b));
      if (lowest.midi % 12 !== bassPC) continue;
    }
    voicings.push({ positionKeys: match.positionKeys, notes, shape: match.shape });
  }
  return voicings;
}
