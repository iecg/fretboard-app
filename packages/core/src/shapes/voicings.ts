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
  /**
   * True when this voicing is a *close-voicing fallback* rendered inside a
   * CAGED/3NPS position that has no full-chord template match. Drives the
   * dashed-stroke degradation cue on the connector layer.
   */
  isFallback?: boolean;
}

export interface CloseVoicingScoreWeights {
  span: number;
  fretted: number;
  compact: number;
  highNeck: number;
  open: number;
}

/** Lower total = more playable. Hand-tuned starting weights; adjustable. */
export const CLOSE_VOICING_SCORE_WEIGHTS: CloseVoicingScoreWeights = {
  span: 3, // wide stretches hurt most
  fretted: 1, // fewer fretted notes = easier
  compact: 1, // reward grips clustered near one hand position
  highNeck: 0.5, // mild lower-neck preference
  open: 1.5, // reward open strings
};

/** Fret above which a grip starts paying the high-neck penalty. */
export const HIGH_NECK_THRESHOLD = 7;

/**
 * Playability cost for a close voicing. Pure of any polygon/position/string-set
 * context — depends only on `voicing.notes` — so the same scorer ranks grips
 * both inside a CAGED polygon (Phase 1) and across the whole neck (Phase 2).
 * Lower is better.
 */
export function scoreCloseVoicing(
  voicing: Voicing,
  weights: CloseVoicingScoreWeights = CLOSE_VOICING_SCORE_WEIGHTS,
): number {
  const fretted = voicing.notes.map((n) => n.fretIndex).filter((f) => f > 0);
  const openCount = voicing.notes.length - fretted.length;
  const span = fretted.length > 0 ? Math.max(...fretted) - Math.min(...fretted) : 0;
  // Sum of absolute deviations from the mean fret (= n × MAD). The integer-
  // arithmetic form below is translation-invariant, so transposed grips score
  // bit-identically (avoids the floating-point drift a direct mean would cause).
  const n = fretted.length;
  const sum = fretted.reduce((a, b) => a + b, 0);
  const compact = n > 0 ? fretted.reduce((s, f) => s + Math.abs(f * n - sum), 0) / n : 0;
  const topFret = voicing.notes.length > 0 ? Math.max(...voicing.notes.map((n) => n.fretIndex)) : 0;
  const highNeck = Math.max(0, topFret - HIGH_NECK_THRESHOLD);

  return (
    weights.span * span +
    weights.fretted * fretted.length +
    weights.compact * compact +
    weights.highNeck * highNeck -
    weights.open * openCount
  );
}

/**
 * Deterministic ordering: lower cost first; ties broken by lower top fret, then
 * lower lowest-string index. Guarantees stable, repeatable grip selection.
 */
export function compareCloseVoicings(a: Voicing, b: Voicing): number {
  const sa = scoreCloseVoicing(a);
  const sb = scoreCloseVoicing(b);
  if (sa !== sb) return sa - sb;
  const topA = a.notes.length > 0 ? Math.max(...a.notes.map((n) => n.fretIndex)) : 0;
  const topB = b.notes.length > 0 ? Math.max(...b.notes.map((n) => n.fretIndex)) : 0;
  if (topA !== topB) return topA - topB;
  const lowA = a.notes.length > 0 ? Math.min(...a.notes.map((n) => n.stringIndex)) : 0;
  const lowB = b.notes.length > 0 ? Math.min(...b.notes.map((n) => n.stringIndex)) : 0;
  return lowA - lowB;
}

/**
 * Max fret gap below which two grips are considered to share neck space.
 * Grips whose fretted-fret windows are within this many frets of each other
 * collapse to the single best-scored grip, so the neck spread never draws
 * overlapping/crossing connectors.
 */
export const NECK_SPREAD_OVERLAP_TOLERANCE = 1;

/**
 * Position-less grip selection for Full mode when no scale pattern is active.
 * Ranks candidates best-first, then greedily accepts a grip only if its
 * fretted-fret window does not overlap an already-accepted grip's window
 * (within NECK_SPREAD_OVERLAP_TOLERANCE). Yields a clean, non-overlapping
 * spread of best grips up the neck — mirroring how Full mode already spreads
 * multiple CAGED shapes across the neck in Scale None.
 */
export function selectNeckSpread(candidates: Voicing[]): Voicing[] {
  const ranked = [...candidates].sort(compareCloseVoicings);
  const accepted: Voicing[] = [];
  const windows: Array<{ lo: number; hi: number }> = [];

  for (const v of ranked) {
    // Open strings (fret 0) are excluded from the window, so any all-open grip
    // collapses to {0,0} — two all-open voicings of a chord never both appear.
    const fretted = v.notes.map((n) => n.fretIndex).filter((f) => f > 0);
    const lo = fretted.length > 0 ? Math.min(...fretted) : 0;
    const hi = fretted.length > 0 ? Math.max(...fretted) : 0;
    const overlaps = windows.some(
      (w) => lo <= w.hi + NECK_SPREAD_OVERLAP_TOLERANCE && hi >= w.lo - NECK_SPREAD_OVERLAP_TOLERANCE,
    );
    if (overlaps) continue;
    accepted.push(v);
    windows.push({ lo, hi });
  }
  return accepted;
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

const MAX_CACHE_ENTRIES = 100;
const voicingCache = new Map<string, Voicing[]>();

export function generateVoicings(params: GenerateVoicingsParams): Voicing[] {
  const cacheKey = `${params.chordRoot}-${params.chordType}-${params.tuning.join(",")}-${params.maxFret}-${params.voicingType}`;
  
  if (voicingCache.has(cacheKey)) {
    const cachedResult = voicingCache.get(cacheKey)!;
    // Move key to the end of insertion order to keep it most-recently-used
    voicingCache.delete(cacheKey);
    voicingCache.set(cacheKey, cachedResult);
    return cachedResult;
  }
  
  let result: Voicing[];
  switch (params.voicingType) {
    case "off":
      result = [];
      break;
    case "full":
      result = fullVoicings(params);
      break;
    case "close":
      result = closeVoicings(params);
      break;
    default:
      result = [];
  }
  
  if (voicingCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = voicingCache.keys().next().value;
    if (oldestKey !== undefined) {
      voicingCache.delete(oldestKey);
    }
  }
  
  voicingCache.set(cacheKey, result);
  return result;
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
 * Maximum fretted-fret span for a close voicing. Capped at 3 so the candidate
 * set stays within playable shapes (typical hand reach around mid-neck, <= 4 physical frets).
 * A larger value re-admits spread/spider shapes that don't feel "close".
 */
export const CLOSE_VOICING_SPAN_LIMIT = 3;

function getPermutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const perm of getPermutations(remaining)) {
      result.push([current, ...perm]);
    }
  }
  return result;
}

/**
 * Generate Close voicings: 3/4/5-note polygons on adjacent strings, where each
 * polygon contains every chord tone (no skipped tones). Note count matches the
 * chord's tone count: triads = 3, tetrads = 4, pentads = 5.
 *
 * Span limit: see {@link CLOSE_VOICING_SPAN_LIMIT}.
 */
function closeVoicings(params: GenerateVoicingsParams): Voicing[] {
  const { chordRoot, chordType, tuning, maxFret } = params;
  const def = CHORD_DEFINITIONS[chordType];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (!def || rootIndex < 0 || tuning.length !== 6) return [];

  const voiceCount = def.members.length;
  if (voiceCount < 3 || voiceCount > 5) return [];

  const chordPCs = def.members.map((m) => (rootIndex + m.semitone) % 12);
  const openMidis = tuning.map(openStringMidi);
  if (openMidis.some((m) => m === null)) return [];

  const voicings: Voicing[] = [];
  const seen = new Set<string>();

  const stringSets: number[][] = [];
  for (let start = 0; start + voiceCount <= 6; start++) {
    const set = [];
    for (let i = 0; i < voiceCount; i++) set.push(start + i);
    stringSets.push(set);
  }

  const pcPermutations = getPermutations(chordPCs);

  for (const stringSet of stringSets) {
    const openStrings = stringSet.map((s) => openMidis[s] as number);

    for (const perm of pcPermutations) {
      const baseFrets = perm.map((pc, i) => {
        const openPc = openStrings[i] % 12;
        return (pc - openPc + 12) % 12;
      });

      let minSpan = Infinity;
      let bestFrets: number[] | null = null;
      const combinations = 1 << voiceCount;
      
      for (let c = 0; c < combinations; c++) {
        let minF = Infinity;
        let maxF = -Infinity;
        const currentFrets = [];
        for (let i = 0; i < voiceCount; i++) {
          const shift = (c & (1 << i)) !== 0 ? 12 : 0;
          const f = baseFrets[i] + shift;
          currentFrets.push(f);
          if (f < minF) minF = f;
          if (f > maxF) maxF = f;
        }
        const span = maxF - minF;
        if (span < minSpan) {
          minSpan = span;
          bestFrets = currentFrets;
        }
      }

      if (minSpan > CLOSE_VOICING_SPAN_LIMIT || !bestFrets) continue;

      let minFret = Math.min(...bestFrets);
      while (minFret >= 12) {
        for (let i = 0; i < voiceCount; i++) bestFrets[i] -= 12;
        minFret -= 12;
      }

      for (let octave = 0; octave * 12 <= maxFret; octave++) {
        const instanceFrets = bestFrets.map((f) => f + octave * 12);
        const highestFret = Math.max(...instanceFrets);

        if (highestFret > maxFret) break;

        const hasOpen = instanceFrets.some((f) => f === 0);
        if (hasOpen && highestFret >= 5) continue;

        const notes: VoicingNote[] = [];
        for (let i = 0; i < voiceCount; i++) {
          const stringIndex = stringSet[i];
          const fretIndex = instanceFrets[i];
          const midi = (openMidis[stringIndex] as number) + fretIndex;
          notes.push({
            stringIndex,
            fretIndex,
            noteName: NOTES[midi % 12],
            midi,
          });
        }

        const positionKeys = notes.map((n) => `${n.stringIndex}-${n.fretIndex}`);
        const key = positionKeys.join("|");

        if (!seen.has(key)) {
          seen.add(key);
          voicings.push({ positionKeys, notes });
        }
      }
    }
  }

  return voicings;
}
