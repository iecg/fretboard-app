import { NOTES, CHORD_DEFINITIONS } from "../theory";
import { parseNote } from "../guitar";
import type { CagedShape } from "./templates";
import { getFullChordShapeMatches } from "./fullChordShapes";

export type VoicingType = "off" | "full" | "close";

export interface VoicingNote {
  stringIndex: number;
  fretIndex: number;
  noteName: string;
  midi: number;
}

export interface Voicing {
  positionKeys: string[];
  notes: VoicingNote[];
  /** Present only for `full` voicings (CAGED). Absent for `close`. */
  shape?: CagedShape;
}

export function openStringMidi(openString: string): number | null {
  const parsed = parseNote(openString);
  if (!parsed) return null;
  const idx = NOTES.indexOf(parsed.noteName);
  if (idx < 0) return null;
  return parsed.octave * 12 + idx;
}

export interface GenerateVoicingsParams {
  chordRoot: string;
  chordType: string;
  tuning: string[];
  maxFret: number;
  voicingType: VoicingType;
}

export function generateVoicings(params: GenerateVoicingsParams): Voicing[] {
  switch (params.voicingType) {
    case "off":
      return [];
    case "full":
      return fullVoicings(params);
    case "close":
      return closeVoicings(params);
  }
}

function fullVoicings(params: GenerateVoicingsParams): Voicing[] {
  const { chordRoot, chordType, tuning, maxFret } = params;
  const openMidis = tuning.map(openStringMidi);
  if (openMidis.some((m) => m === null)) return [];
  const matches = getFullChordShapeMatches({ chordRoot, chordType, tuning, maxFret });
  return matches.map((match) => ({
    positionKeys: match.positionKeys,
    notes: match.notes.map((n) => ({
      stringIndex: n.stringIndex,
      fretIndex: n.fretIndex,
      noteName: n.noteName,
      midi: (openMidis[n.stringIndex] as number) + n.fretIndex,
    })),
    shape: match.shape,
  }));
}

/**
 * Generate Close voicings: 3/4/5-note polygons on adjacent strings, where each
 * polygon contains every chord tone (no skipped tones). Note count matches the
 * chord's tone count: triads = 3, tetrads = 4, pentads = 5.
 *
 * Span limit: a maximum 6-fret raw span (the pinky reach of a typical hand at
 * mid-neck). The hand-span physical filter at the atom layer prunes further.
 */
function closeVoicings(params: GenerateVoicingsParams): Voicing[] {
  const { chordRoot, chordType, tuning, maxFret } = params;
  const def = CHORD_DEFINITIONS[chordType];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (!def || rootIndex < 0 || tuning.length !== 6) return [];

  // Close voicings use 3..5 notes. Below 3 (e.g. dyads) the close concept does
  // not apply — return [] so the UI cycle is empty.
  const voiceCount = def.members.length;
  if (voiceCount < 3 || voiceCount > 5) return [];

  const chordPCs = def.members.map((m) => (rootIndex + m.semitone) % 12);
  const chordPCSet = new Set(chordPCs);
  const openMidis = tuning.map(openStringMidi);
  if (openMidis.some((m) => m === null)) return [];

  const candidateFrets: Record<number, number[]> = {};
  for (let s = 0; s < 6; s += 1) {
    const open = openMidis[s] as number;
    const frets: number[] = [];
    for (let f = 0; f <= maxFret; f += 1) {
      if (chordPCSet.has((open + f) % 12)) frets.push(f);
    }
    candidateFrets[s] = frets;
  }

  const RAW_SPAN_LIMIT = 6;
  const voicings: Voicing[] = [];
  const seen = new Set<string>();

  for (let start = 0; start + voiceCount <= 6; start += 1) {
    const run: number[] = [];
    for (let i = 0; i < voiceCount; i += 1) run.push(start + i);

    const dfs = (depth: number, picked: VoicingNote[]) => {
      if (depth === run.length) {
        // Every chord pitch class must be present exactly once.
        const pcs = new Set(picked.map((n) => n.midi % 12));
        if (pcs.size !== chordPCSet.size) return;
        for (const pc of chordPCSet) if (!pcs.has(pc)) return;

        // Reject voicings that mix an open string with high frets — these produce
        // spread shapes that aren't really "close". An all-open or all-low chord
        // (max fret < 5) is fine; a fully-fretted chord above the nut is fine.
        const hasOpen = picked.some((n) => n.fretIndex === 0);
        if (hasOpen) {
          const maxFret = Math.max(...picked.map((n) => n.fretIndex));
          if (maxFret >= 5) return;
        }

        // Raw fret-span gate.
        const frettedFrets = picked
          .map((n) => n.fretIndex)
          .filter((f) => f > 0);
        if (frettedFrets.length >= 2) {
          const span =
            Math.max(...frettedFrets) - Math.min(...frettedFrets);
          if (span > RAW_SPAN_LIMIT) return;
        }

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
