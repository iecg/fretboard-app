import type { TransitionRole } from "./semantics";

/** Most simultaneous move cues shown in one transition (keeps it legible). */
export const MAX_VOICE_LEADING_MOVES = 3;
/** Minimum source→target distance (SVG user units) for a cue; below this the
 *  ghost just fades in place — no visible slide, so don't add jitter. */
export const MIN_VOICE_LEADING_TRAVEL_PX = 8;
/** A voice-leading move stays within a hand position: at most this many frets… */
export const MAX_VOICE_LEADING_FRET_SPAN = 3;
/** …and at most this many strings away. Beyond EITHER, no slide — the incoming
 *  note just fades in place (prevents cross-fretboard jumps). */
export const MAX_VOICE_LEADING_STRING_SPAN = 2;

/** Minimal positioned-note shape the pairing needs. `RenderedFretboardNote`
 *  satisfies this structurally. */
export interface VoiceLeadingNote {
  stringIndex: number;
  fretIndex: number;
  cx: number;
  cy: number;
  isInRegion: boolean;
  transitionRole?: TransitionRole;
}

export interface VoiceLeadingMove {
  /** `"${stringIndex}-${fretIndex}"` of the arriving (incoming) note. */
  targetKey: string;
  /** `"${stringIndex}-${fretIndex}"` of the paired source note. */
  sourceKey: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** source − target: the translate the ghost animates FROM, in user units. */
  dx: number;
  dy: number;
}

const keyOf = (n: { stringIndex: number; fretIndex: number }): string =>
  `${n.stringIndex}-${n.fretIndex}`;

/**
 * Pair each in-region incoming note to its nearest in-region departing/held
 * source (greedy, one source per target). Keeps only moves within the fret/string span,
 * caps at {@link MAX_VOICE_LEADING_MOVES} keeping the SHORTEST travels, and logs any
 * drop (no silent truncation). Returns [] outside the lead-in window because
 * there are no `incoming`-role notes then.
 */
export function computeVoiceLeadingMoves(
  notes: VoiceLeadingNote[],
): VoiceLeadingMove[] {
  const inRegion = notes.filter((n) => n.isInRegion);
  const targets = inRegion
    .filter((n) => n.transitionRole === "incoming")
    .sort((a, b) => a.stringIndex - b.stringIndex || a.fretIndex - b.fretIndex);
  const sources = inRegion.filter(
    (n) => n.transitionRole === "departing" || n.transitionRole === "held",
  );
  if (targets.length === 0 || sources.length === 0) return [];

  const usedSourceKeys = new Set<string>();
  const candidates: Array<VoiceLeadingMove & { dist: number }> = [];

  for (const target of targets) {
    let best: VoiceLeadingNote | null = null;
    let bestDist = Infinity;
    for (const source of sources) {
      if (usedSourceKeys.has(keyOf(source))) continue;
      // A voice-leading move stays within a hand position — skip any source
      // beyond the fret/string span so nothing slides across the neck.
      if (Math.abs(source.fretIndex - target.fretIndex) > MAX_VOICE_LEADING_FRET_SPAN) continue;
      if (Math.abs(source.stringIndex - target.stringIndex) > MAX_VOICE_LEADING_STRING_SPAN) continue;
      const d = Math.hypot(source.cx - target.cx, source.cy - target.cy);
      if (d < bestDist) {
        bestDist = d;
        best = source;
      }
    }
    if (!best) continue;
    if (bestDist < MIN_VOICE_LEADING_TRAVEL_PX) continue;
    usedSourceKeys.add(keyOf(best));
    candidates.push({
      targetKey: keyOf(target),
      sourceKey: keyOf(best),
      fromX: best.cx,
      fromY: best.cy,
      toX: target.cx,
      toY: target.cy,
      dx: best.cx - target.cx,
      dy: best.cy - target.cy,
      dist: bestDist,
    });
  }

  if (candidates.length <= MAX_VOICE_LEADING_MOVES) {
    return candidates.map(stripDist);
  }

  const kept = [...candidates]
    .sort((a, b) => a.dist - b.dist)
    .slice(0, MAX_VOICE_LEADING_MOVES);
  console.debug(
    `[voiceLeading] capped ${candidates.length} moves to ${MAX_VOICE_LEADING_MOVES} (dropped ${candidates.length - kept.length})`,
  );
  kept.sort((a, b) => a.targetKey.localeCompare(b.targetKey));
  return kept.map(stripDist);
}

function stripDist(m: VoiceLeadingMove & { dist: number }): VoiceLeadingMove {
  const { dist, ...move } = m;
  void dist; // intentional drop
  return move;
}
