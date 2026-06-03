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
 * strings (e.g. ["C3","E3","G3","A4"]), or [] when the root or quality is
 * unrecognized (same contract as resolveChordVoicing — callers treat [] as
 * "no audible chord").
 *
 * Note on bass voice: tones are placed in ascending pitch-class order from
 * `floorAbs`, NOT stacked from the root. So a chord whose root has a higher
 * chroma than its other intervals comes out inverted (e.g. G major → D3 G3 B3,
 * not G3 B3 D4). This is intentional — the bass line carries the root, and
 * ascending-pitch-class placement is what lets the low-interval limit keep the
 * grip clean. It is also a deliberate behavior change from the old root-stacked
 * `resolveChordVoicing` on the strum path.
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

  const chromasSorted = members
    .map((m) => (rootIndex + m.semitone) % 12)
    .sort((a, b) => a - b);

  // Steps 2 + 3 — placement (low-interval limit) and register normalization,
  // anchored from a given floor.
  const place = (floorAbs: number): number[] => {
    const placed: number[] = [];
    for (let i = 0; i < chromasSorted.length; i++) {
      const min = i === 0 ? floorAbs : placed[i - 1] + 1;
      let abs = liftToPc(min, chromasSorted[i]);
      // Low-interval limit: while below the threshold and tighter than the
      // minimum interval above the voice below, raise an octave.
      while (
        i > 0 &&
        abs < preset.lilThresholdAbs &&
        abs - placed[i - 1] < preset.minLowIntervalSemitones
      ) {
        abs += 12;
      }
      placed.push(abs);
    }
    // Register normalization: drop the whole voicing an octave until the top
    // voice fits under the ceiling.
    while (placed.length > 0 && Math.max(...placed) > preset.ceilAbs) {
      for (let i = 0; i < placed.length; i++) placed[i] -= 12;
    }
    return placed;
  };

  // Step 4 — spacing-safe voice leading. Each candidate already satisfies the
  // spacing invariant, so voice leading can never reintroduce a low cluster.
  if (prevVoicing && prevVoicing.length > 0) {
    // Three octave anchors span C2–C4; register normalization folds anything above C5 back down.
    const anchors = [
      preset.floorAbs - 12,
      preset.floorAbs,
      preset.floorAbs + 12,
    ];
    const candidates = anchors.map((a) => toNoteStrings(place(a)));
    let best = candidates[0];
    let minDistance = Infinity;
    for (const candidate of candidates) {
      const d = calculateDistance(prevVoicing, candidate);
      if (d < minDistance) {
        minDistance = d;
        best = candidate;
      }
    }
    return best;
  }

  return toNoteStrings(place(preset.floorAbs));
}
