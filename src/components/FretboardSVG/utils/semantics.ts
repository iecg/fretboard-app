import type { NoteSemantics } from "@fretflow/core";
import {
  RADIUS_SCALE_KEY_TONIC,
  RADIUS_SCALE_DEFAULT,
} from "@fretflow/core";
import type { PracticeLens } from "../../../store/practiceLensAtoms";

export type BoxBound = { minFret: number; maxFret: number };

/** Gentle size hold for pivot/common tones under the Field lens. */
const COMMON_HOLD_RADIUS_BOOST = 1.15;

export type TransitionRole = "guide-target" | "hold-common";

export type LensEmphasis = {
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
  /** True while the single continuous countdown window is open. */
  guideCountdownActive: boolean;
  /** Active improvisation lens — selects the emphasis mode. */
  lens: PracticeLens;
  /** Pitch classes shared between the active chord and the next (`active ∩ next`). */
  commonTones: Set<string>;
};

/**
 * Fallback emphasis when no progression is active or no voice-leading
 * context applies. Dims scale-only / color-tone notes. Guide tones (3rd/7th)
 * carry their identity entirely through their teal hue (CSS
 * `[data-note-guide-tone]`), so the base emphasis adds no static glow or size
 * boost — that channel is reserved for the progression lead-in ring.
 */
function applyTonesBase(noteClass: string): LensEmphasis {
  if (noteClass === "scale-only" || noteClass === "color-tone") {
    return { radiusBoost: 0.85, opacityBoost: 0.7 };
  }
  return { radiusBoost: 1, opacityBoost: 1 };
}

export function getEmphasis(
  noteClass: string,
  // Guide-tone identity is carried by the teal hue, not the emphasis layer, so
  // this flag no longer affects the result. The parameter is retained to keep
  // the call-site contract (and the lead-in voice-leading path) stable.
  _isGuideTone: boolean,
  leadContext?: LeadLensContext,
): LensEmphasis {
  if (!leadContext) {
    return applyTonesBase(noteClass);
  }

  const { notePc, nextGuideTones, nextGuideToneLabels, guideCountdownActive, lens, commonTones } = leadContext;

  // The note's resting emphasis when not actively targeted — the base model.
  const resting: LensEmphasis = applyTonesBase(noteClass);

  // Countdown: the next chord's guide tones get the single continuous ring.
  if (guideCountdownActive && nextGuideTones.has(notePc)) {
    return {
      radiusBoost: resting.radiusBoost,
      opacityBoost: 1,
      transitionRole: "guide-target",
      guideTargetLabel: nextGuideToneLabels.get(notePc),
    };
  }

  // Field lens: notes shared with the next chord get a steady hold (size +
  // full opacity, static ring) through the guide countdown window, showing
  // what survives the change. No drain/ticks — the ring path is quiet because
  // the common lens returns an empty target set; this branch supplies the cue.
  if (lens === "common" && guideCountdownActive && commonTones.has(notePc)) {
    return {
      radiusBoost: COMMON_HOLD_RADIUS_BOOST,
      opacityBoost: 1,
      transitionRole: "hold-common",
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
  // Chromatic-to-key color note inside the active shape → blue diamond, matching
  // classifyNoteFromSemantics (the production path). Keeps both classifiers in
  // lockstep so identical note states never diverge by render path.
  if (isHighlighted && isColorNote && isInActiveShape) return "note-blue";
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
  if (sem.isColorTone && isInActiveShape && isHighlighted) return "note-blue";
  if (sem.isInScale && isInActiveShape && isHighlighted) return "scale-only";
  if (sem.isChordTone && isInActiveShape) return "chord-tone-outside-scale";
  return "note-inactive";
}

type NoteShape = "circle" | "diamond";

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
      return { radiusScale: RADIUS_CHORD, noteShape: "circle" };
    case "scale-only":
      return { radiusScale: RADIUS_SCALE, noteShape: "circle" };
    // No-overlay scale tone — the scale IS the figure, so it stays present
    // (medium) rather than receding to scale-tier size.
    case "note-active":
      return { radiusScale: RADIUS_OUTSIDE, noteShape: "circle" };
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
