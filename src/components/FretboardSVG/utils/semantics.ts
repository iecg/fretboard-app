import type { NoteSemantics } from "@fretflow/core";
import {
  RADIUS_SCALE_KEY_TONIC,
  RADIUS_SCALE_DEFAULT,
} from "@fretflow/core";

export type BoxBound = { minFret: number; maxFret: number };

export type TransitionRole = "guide-target";

export type LensEmphasis = {
  glowColor?: `var(--${string})`;
  radiusBoost: number;
  opacityBoost: number;
  /** Discrete voice-leading role during the lead-in window; undefined = static. */
  transitionRole?: TransitionRole;
  /** Interval function of this note in the next chord (e.g. "3", "b3", "5", "b7"). */
  guideTargetLabel?: string;
};

/**
 * Per-note context for voice-leading emphasis. Built once per render in
 * `useAnimatedFretboardView` and passed per-note into `getEmphasis`. All
 * fields use the sharps-convention pitch classes that FretFlow stores
 * internally (C#, D#, …).
 */
export type LeadLensContext = {
  /** Pitch class of the note being classified. */
  notePc: string;
  /** Notes shared between the active chord and the next chord (common tones). */
  commonWithNext: Set<string>;
  /** Guide tones (3rd/7th) of the next chord. */
  nextGuideTones: Set<string>;
  /** Interval labels for the next chord's guide tones (pitch class → name, e.g. "B" → "3"). */
  nextGuideToneLabels: Map<string, string>;
  /** ALL pitch classes of the next chord. */
  nextChordTones: Set<string>;
  /** Pitch classes the next chord introduces (`next − current`). */
  incomingTones: Set<string>;
  /** Pitch classes the active chord drops on the change (`current − next`). */
  departingTones: Set<string>;
  /** True only during the lead-in preview window. */
  leadInActive: boolean;
};

/**
 * Chord-tone noteClass values — a note with one of these classes is considered
 * a "current chord tone" for the Lead lens hold/departing logic.
 */
const CHORD_TONE_CLASSES = new Set([
  "chord-root",
  "chord-root-outside",
  "chord-tone-in-scale",
  "chord-tone-outside-scale",
  "note-diatonic-chord",
]);

/**
 * Fallback emphasis when no progression is active or no voice-leading
 * context applies. Boosts guide tones with the hold-glow token and dims
 * scale-only / color-tone notes.
 */
function applyTonesBase(
  noteClass: string,
  isGuideTone: boolean,
): LensEmphasis {
  if (isGuideTone) {
    return { glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 };
  }
  if (noteClass === "scale-only" || noteClass === "color-tone") {
    return { radiusBoost: 0.85, opacityBoost: 0.7 };
  }
  return { radiusBoost: 1, opacityBoost: 1 };
}

export function getEmphasis(
  noteClass: string,
  isGuideTone: boolean,
  leadContext?: LeadLensContext,
): LensEmphasis {
  if (!leadContext) {
    return applyTonesBase(noteClass, isGuideTone);
  }

  const { notePc, nextGuideTones, nextGuideToneLabels, commonWithNext, leadInActive } = leadContext;

  // The note's resting emphasis when not actively targeted — held common tones
  // keep a gentle hold glow, everything else uses the base model. This is the
  // size/shape a note shows OUTSIDE the lead-in window.
  const resting: LensEmphasis =
    CHORD_TONE_CLASSES.has(noteClass) && commonWithNext.has(notePc)
      ? { glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 }
      : applyTonesBase(noteClass, isGuideTone);

  // Lead-in: ONLY the next chord's guide tones deviate from their resting
  // emphasis. A target keeps its resting SIZE (no bloom), is brought to full
  // opacity, and gets the ring hue + role + label. Every other note returns its
  // resting emphasis untouched — nothing dims, so the board holds still and the
  // ring's onset carries the attention by itself.
  if (leadInActive && nextGuideTones.has(notePc)) {
    return {
      glowColor: "var(--note-incoming)",
      radiusBoost: resting.radiusBoost,
      opacityBoost: 1,
      transitionRole: "guide-target",
      guideTargetLabel: nextGuideToneLabels.get(notePc),
    };
  }
  return resting;
}

export function classifyNote(
  isScaleRoot: boolean,
  isChordRootNote: boolean,
  isColorNote: boolean,
  isHighlighted: boolean,
  isChordTone: boolean,
  hasChordOverlay: boolean,
  isInActiveShape: boolean,
): string {
  if (!hasChordOverlay) {
    if (isScaleRoot && isHighlighted) return "key-tonic";
    if (isColorNote && isHighlighted) return "note-blue";
    if (isHighlighted) return "note-active";
    return "note-inactive";
  }

  if (isChordRootNote && isChordTone && isInActiveShape) return "chord-root";
  if (isHighlighted && isChordTone && isInActiveShape) return "chord-tone-in-scale";
  if (isHighlighted && isColorNote && isInActiveShape) return "color-tone";
  if (isHighlighted && isInActiveShape) return "scale-only";
  if (!isHighlighted && isChordTone && isInActiveShape)
    return "chord-tone-outside-scale";
  return "note-inactive";
}

export function classifyNoteFromSemantics(
  sem: NoteSemantics,
  isInActiveShape: boolean,
  hasChordOverlay: boolean,
  isHighlighted: boolean,
): string {
  if (!hasChordOverlay) {
    return classifyNote(
      sem.isScaleRoot, sem.isChordRoot, sem.isColorTone, isHighlighted,
      sem.isChordTone, hasChordOverlay, isInActiveShape,
    );
  }

  if (sem.isChordRoot && sem.isChordTone && isInActiveShape)
    return sem.isInScale ? "chord-root" : "chord-root-outside";
  if (sem.isDiatonicChord && sem.isChordTone && isInActiveShape) return "note-diatonic-chord";
  if (sem.isInScale && sem.isChordTone && isInActiveShape) return "chord-tone-in-scale";
  if (sem.isInScale && sem.isColorTone && isInActiveShape && isHighlighted) return "color-tone";
  if (sem.isInScale && isInActiveShape && isHighlighted) return "scale-only";
  if (sem.isChordTone && isInActiveShape) return "chord-tone-outside-scale";
  return "note-inactive";
}

type NoteShape = "circle" | "squircle" | "diamond";

export type NoteVisuals = {
  radiusScale: number;
  noteShape: NoteShape;
};

// Marker sizing: chord tier large, scale tier small (recedes), outside tier medium.
const RADIUS_CHORD = 0.95;
const RADIUS_SCALE = 0.66;
const RADIUS_OUTSIDE = 0.8;

export function getNoteVisuals(noteClass: string): NoteVisuals {
  switch (noteClass) {
    case "key-tonic":
      return { radiusScale: RADIUS_SCALE_KEY_TONIC, noteShape: "circle" };
    case "chord-root":
    case "chord-tone-in-scale":
    case "note-diatonic-chord":
      return { radiusScale: RADIUS_CHORD, noteShape: "squircle" };
    case "note-active":
    case "scale-only":
      return { radiusScale: RADIUS_SCALE, noteShape: "circle" };
    case "color-tone":
      return { radiusScale: RADIUS_OUTSIDE, noteShape: "circle" };
    // An outside-key chord root keeps its home (amber) identity via color, but
    // the diamond shape marks it chromatic — and it stays chord-tier sized.
    case "chord-root-outside":
      return { radiusScale: RADIUS_CHORD, noteShape: "diamond" };
    // Shape encodes harmonic insideness: chromatic / outside-key → angular diamond.
    case "note-blue":
    case "chord-tone-outside-scale":
      return { radiusScale: RADIUS_OUTSIDE, noteShape: "diamond" };
    default:
      return { radiusScale: RADIUS_SCALE_DEFAULT, noteShape: "circle" };
  }
}
