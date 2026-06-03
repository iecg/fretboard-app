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

/**
 * Build a clean, well-spaced strum voicing for a chord. Pure. Returns note
 * strings (e.g. ["C3","E3","G3","A4"]), or [] when the root or quality is
 * unrecognized (same contract as resolveChordVoicing — callers treat [] as
 * "no audible chord").
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

  const toNotes = toNoteStrings;

  // Step 4 — spacing-safe voice leading. Each candidate already satisfies the
  // spacing invariant, so voice leading can never reintroduce a low cluster.
  if (prevVoicing && prevVoicing.length > 0) {
    const anchors = [
      preset.floorAbs - 12,
      preset.floorAbs,
      preset.floorAbs + 12,
    ];
    const candidates = anchors.map((a) => toNotes(place(a)));
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

  return toNotes(place(preset.floorAbs));
}
