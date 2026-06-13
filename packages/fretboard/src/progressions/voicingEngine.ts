import { CHORD_DEFINITIONS, NOTES } from "@fretflow/core";
import { calculateDistance } from "./voiceLeading";

/**
 * Tuning knobs for one voicing "style". Pitches are absolute integers
 * (octave * 12 + chroma), matching progressionAudio.ts: C3 = 36, C4 = 48,
 * C5 = 60.
 */
export interface VoicingPreset {
  /** strum: true; future rootless presets (funk/bossa): false */
  includeRoot: boolean;
  /** maximum voices kept before placement */
  maxNotes: number;
  /** the lowest voice is anchored at or just above this pitch */
  floorAbs: number;
  /** the top voice must not exceed this pitch (register normalization) */
  ceilAbs: number;
  /** below this pitch, the low-interval limit applies */
  lilThresholdAbs: number;
  /** smallest interval (semitones) allowed below lilThresholdAbs */
  minLowIntervalSemitones: number;
}

/** Strum voicing selection weights — eyeball-tuned, adjustable. Lower cost wins. */
export const STRUM_VOICING_SCORE_WEIGHTS = {
  /** Voice-leading: distance to the previous chord. Dominates once a prev exists. */
  lead: 2,
  /** Keep the grip near the comp register center. */
  center: 1,
  /** Mild preference for compact grips. */
  span: 0.3,
  /** Mild discouragement of a 5th-in-bass (2nd-inversion) grip. */
  bassFifth: 5,
} as const;

/**
 * The register the whole comp gravitates toward (A3, low-mid). Sole register
 * dial — raise for brighter/higher grips, lower for darker/open ones. Tuned by
 * ear; the exact inversion per chord is an emergent consequence, not pinned.
 */
const REGISTER_CENTER = 45;

/** Default strum voicing style for Rock / Pop / Blues / Ballad. */
export const STRUM_PRESET: VoicingPreset = {
  includeRoot: true,
  maxNotes: 5,
  floorAbs: 36, // C3
  ceilAbs: 60, // C5
  lilThresholdAbs: 48, // C4
  minLowIntervalSemitones: 3, // minor third
};

/**
 * Drop priority when a chord has more members than `maxNotes`. The 5th goes
 * first, then the root. Guide tones (3/b3, 7/b7) and color tones (6, 9, 13,
 * sus 2/4) are always kept.
 */
const DROP_PRIORITY = ["5", "root"] as const;

/** Smallest absolute pitch >= `min` whose chroma === `pc`. */
function liftToPc(min: number, pc: number): number {
  const offset = (((min % 12) - pc) % 12 + 12) % 12;
  const base = min - offset;
  return base >= min ? base : base + 12;
}

function toNoteStrings(absolutes: number[]): string[] {
  return absolutes.map((a) => {
    const chroma = ((a % 12) + 12) % 12;
    return `${NOTES[chroma]}${Math.floor(a / 12)}`;
  });
}

export type ToneRole = "root" | "guide" | "fifth" | "color" | "other";

interface Tone {
  pc: number;
  role: ToneRole;
}

interface Voice {
  abs: number;
  role: ToneRole;
}

/** Classify a chord member by its harmonic function for voicing rules. */
function roleOf(name: string): ToneRole {
  if (name === "root") return "root";
  if (name === "3" || name === "b3" || name === "7" || name === "b7" || name === "bb7") {
    return "guide";
  }
  if (name === "5" || name === "b5" || name === "#5") return "fifth";
  if (name === "6" || name === "9" || name === "13") return "color";
  return "other"; // 2, 4 (sus)
}

/**
 * Stack a chord as an inversion: `bassIdx` selects the lowest tone; the rest are
 * stacked strictly ascending above it, wrapping octaves, anchored so the bass is
 * the lowest pitch >= floorAbs.
 */
function buildInversion(tones: Tone[], bassIdx: number, floorAbs: number): Voice[] {
  const n = tones.length;
  const voices: Voice[] = [];
  let prev = liftToPc(floorAbs, tones[bassIdx].pc);
  voices.push({ abs: prev, role: tones[bassIdx].role });
  for (let i = 1; i < n; i++) {
    const t = tones[(bassIdx + i) % n];
    const abs = liftToPc(prev + 1, t.pc);
    voices.push({ abs, role: t.role });
    prev = abs;
  }
  return voices;
}

/**
 * Open-voicing move: raise the 5th to just above the current top voice, keeping
 * the color tone internal. Returns null if there is no 5th or it is already on top.
 */
function spreadFifth(voices: Voice[]): Voice[] | null {
  const sorted = [...voices].sort((a, b) => a.abs - b.abs);
  const top = sorted[sorted.length - 1].abs;
  const idx = sorted.findIndex((v) => v.role === "fifth");
  if (idx < 0 || sorted[idx].abs >= top) return null;
  let abs = sorted[idx].abs;
  while (abs <= top) abs += 12;
  const raised = sorted.map((v, i) => (i === idx ? { abs, role: v.role } : v));
  return raised.sort((a, b) => a.abs - b.abs);
}

/** Transpose the whole voicing down by octaves until the top voice fits the ceiling. */
function normalizeRegister(voices: Voice[], ceilAbs: number): Voice[] {
  let v = [...voices];
  while (v.length > 0 && Math.max(...v.map((x) => x.abs)) > ceilAbs) {
    v = v.map((x) => ({ abs: x.abs - 12, role: x.role }));
  }
  return v;
}

/** No interval tighter than `minLow` between adjacent voices that are both below `threshold`. */
function passesSpacing(voices: Voice[], threshold: number, minLow: number): boolean {
  const s = [...voices].sort((a, b) => a.abs - b.abs);
  for (let i = 1; i < s.length; i++) {
    if (s[i].abs < threshold && s[i].abs - s[i - 1].abs < minLow) return false;
  }
  return true;
}

/** A color tone (6/9/13) may not be the highest or lowest voice when a non-color tone exists. */
function colorInternal(voices: Voice[]): boolean {
  const s = [...voices].sort((a, b) => a.abs - b.abs);
  if (!s.some((v) => v.role !== "color")) return true; // all-color: impossible for real chords
  return s[0].role !== "color" && s[s.length - 1].role !== "color";
}

/** Test-only handle so the pure helpers can be unit-tested without widening the public API. */
export const __testables = {
  roleOf,
  buildInversion,
  spreadFifth,
  normalizeRegister,
  passesSpacing,
  colorInternal,
};

/**
 * Build a clean, well-spaced strum voicing for a chord. Pure. Returns note
 * strings (e.g. ["E3","A3","C4","G4"]), or [] when the root or quality is
 * unrecognized (same contract as resolveChordVoicing — callers treat [] as
 * "no audible chord").
 *
 * Strategy: generate → filter → score. All inversions (plus a spread-5th
 * variant) are enumerated at two octave anchors and register-normalized.
 * Candidates that violate spacing (low-interval limit) or put a color tone
 * (6/9/13) on the top or bottom voice are rejected. The surviving pool is
 * scored by voice-leading distance to the previous chord, proximity to
 * REGISTER_CENTER, compactness, and a mild penalty for 5th-in-bass. The
 * lowest-cost candidate wins (tie-broken deterministically).
 */
export function buildVoicing(
  root: string,
  quality: string,
  prevVoicing: string[] | undefined,
  preset: VoicingPreset,
): string[] {
  const def = CHORD_DEFINITIONS[quality];
  if (!def) return [];
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];

  // Step 1 — resolve and select tones.
  let members = def.members.slice();
  if (!preset.includeRoot) {
    members = members.filter((m) => m.name !== "root");
  }
  while (members.length > preset.maxNotes) {
    let removed = false;
    for (const name of DROP_PRIORITY) {
      const i = members.findIndex((m) => m.name === name);
      if (i >= 0) {
        members.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) break; // nothing left in the drop priority; keep what remains
  }
  if (members.length === 0) return [];

  const tones: Tone[] = members.map((m) => ({
    pc: (rootIndex + m.semitone) % 12,
    role: roleOf(m.name),
  }));

  // Step 2 — generate candidates: every inversion (+ a spread-5th variant) at two
  // octave anchors, each register-normalized.
  const anchors = [preset.floorAbs, preset.floorAbs + 12];
  const candidates: Voice[][] = [];
  for (const anchor of anchors) {
    for (let b = 0; b < tones.length; b++) {
      const inv = buildInversion(tones, b, anchor);
      candidates.push(normalizeRegister(inv, preset.ceilAbs));
      const spread = spreadFifth(inv);
      if (spread) candidates.push(normalizeRegister(spread, preset.ceilAbs));
    }
  }

  // Step 3 — filter to the hard invariants.
  const valid = candidates.filter(
    (c) =>
      passesSpacing(c, preset.lilThresholdAbs, preset.minLowIntervalSemitones) &&
      colorInternal(c),
  );
  const pool = valid.length > 0 ? valid : [fallbackStack(tones, preset)];

  // Step 4 — score and select (deterministic).
  const w = STRUM_VOICING_SCORE_WEIGHTS;
  let best: Voice[] | null = null;
  let bestKey: readonly [number, number, string] | null = null;
  for (const cand of pool) {
    const s = [...cand].sort((a, b) => a.abs - b.abs);
    const notes = toNoteStrings(s.map((v) => v.abs));
    const lead = prevVoicing && prevVoicing.length > 0 ? calculateDistance(prevVoicing, notes) : 0;
    const center = s.reduce((acc, v) => acc + Math.abs(v.abs - REGISTER_CENTER), 0);
    const span = s[s.length - 1].abs - s[0].abs;
    const bassFifth = s[0].role === "fifth" ? 1 : 0;
    const cost = w.lead * lead + w.center * center + w.span * span + w.bassFifth * bassFifth;
    const key = [cost, s[0].abs, notes.join(",")] as const;
    if (
      bestKey === null ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && key[1] < bestKey[1]) ||
      (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])
    ) {
      best = s;
      bestKey = key;
    }
  }
  return best ? toNoteStrings(best.map((v) => v.abs)) : [];
}

/** Degenerate fallback: the old ascending stack, used only if every candidate is filtered out. */
function fallbackStack(tones: Tone[], preset: VoicingPreset): Voice[] {
  const sorted = [...tones].sort((a, b) => a.pc - b.pc);
  const voices: Voice[] = [];
  let prev = preset.floorAbs;
  for (let i = 0; i < sorted.length; i++) {
    const min = i === 0 ? preset.floorAbs : prev + 1;
    let abs = liftToPc(min, sorted[i].pc);
    while (
      i > 0 &&
      abs < preset.lilThresholdAbs &&
      abs - prev < preset.minLowIntervalSemitones
    ) {
      abs += 12;
    }
    voices.push({ abs, role: sorted[i].role });
    prev = abs;
  }
  return normalizeRegister(voices, preset.ceilAbs);
}
