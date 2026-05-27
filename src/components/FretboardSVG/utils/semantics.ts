import type { NoteSemantics } from "@fretflow/core";
import {
  RADIUS_SCALE_KEY_TONIC,
  RADIUS_SCALE_CHORD_ROOT,
  RADIUS_SCALE_CHORD_TONE,
  RADIUS_SCALE_NOTE_ACTIVE,
  RADIUS_SCALE_COLOR_TONE,
  RADIUS_SCALE_DEFAULT,
} from "@fretflow/core";

export type BoxBound = { minFret: number; maxFret: number };

export type LensEmphasis = {
  glowColor?: "cyan" | "orange" | "violet";
  radiusBoost: number;
  opacityBoost: number;
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
  /** Guide tones (3rd/7th) of the next chord — shown as anticipation in the last beat. */
  nextGuideTones: Set<string>;
  /** Current beat position within the active progression step (0 = just started). */
  beatPosition: number;
  /** Total duration of the active step in beats. */
  stepDurationBeats: number;
};

/**
 * Chord-tone noteClass values — a note with one of these classes is considered
 * a "current chord tone" for the Lead lens hold/departing logic.
 */
const CHORD_TONE_CLASSES = new Set([
  "chord-root",
  "chord-tone-in-scale",
  "chord-tone-outside-scale",
  "note-diatonic-chord",
]);

/**
 * Applies the Tones lens logic (guide-tone emphasis + scale-only dim).
 * Shared between the "tones" case and the Lead lens fallback path.
 */
function applyTonesBase(
  noteClass: string,
  isGuideTone: boolean,
): LensEmphasis {
  if (isGuideTone) {
    return { glowColor: "cyan", radiusBoost: 1.15, opacityBoost: 1 };
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
  // Voice-leading emphasis based on how the current note relates to the
  // upcoming chord change. Priority order (highest → lowest):
  //   1. Anticipation — next chord's guide tone in the last beat window
  //      (fires even on notes not in the current chord)
  //   2. Hold — current chord tone that carries into the next chord
  //   3. Departing — current chord tone that resolves away on the change
  //   4. Tones base — guide-tone glow + scale-only dim
  //
  // When leadContext is not provided (e.g. no active progression),
  // fall back to tones-base behavior so visuals still render meaningfully.
  if (!leadContext) {
    return applyTonesBase(noteClass, isGuideTone);
  }

  const {
    notePc,
    commonWithNext,
    nextGuideTones,
    beatPosition,
    stepDurationBeats,
  } = leadContext;

  const isCurrentChordTone = CHORD_TONE_CLASSES.has(noteClass);

  // 1. Anticipation: next chord's guide tone in the last-beat window.
  //    Applies regardless of current-chord membership.
  if (
    stepDurationBeats > 0 &&
    beatPosition >= stepDurationBeats - 1 &&
    nextGuideTones.has(notePc)
  ) {
    return { glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 };
  }

  // 2. Hold: current chord tone that persists into the next chord.
  if (isCurrentChordTone && commonWithNext.has(notePc)) {
    return { glowColor: "cyan", radiusBoost: 1.2, opacityBoost: 1 };
  }

  // 3. Departing: current chord tone that doesn't carry into the next chord.
  if (isCurrentChordTone && !commonWithNext.has(notePc)) {
    return { radiusBoost: 0.85, opacityBoost: 0.6 };
  }

  // 4. Tones base.
  return applyTonesBase(noteClass, isGuideTone);
}

export function classifyNote(
  isScaleRoot: boolean,
  isChordRootNote: boolean,
  isColorNote: boolean,
  isHighlighted: boolean,
  isChordTone: boolean,
  hasChordOverlay: boolean,
  isChordInRange: boolean,
  isInActiveShape: boolean,
): string {
  if (!hasChordOverlay) {
    if (isScaleRoot && isHighlighted) return "key-tonic";
    if (isColorNote && isHighlighted) return "note-blue";
    if (isHighlighted) return "note-active";
    return "note-inactive";
  }

  if (isChordRootNote && isChordTone && isChordInRange && isInActiveShape) return "chord-root";
  if (isHighlighted && isChordTone && isChordInRange && isInActiveShape) return "chord-tone-in-scale";
  if (isHighlighted && isColorNote && isInActiveShape) return "color-tone";
  if (isHighlighted && isInActiveShape) return "scale-only";
  if (!isHighlighted && isChordTone && isChordInRange && isInActiveShape)
    return "chord-tone-outside-scale";
  return "note-inactive";
}

export function classifyNoteFromSemantics(
  sem: NoteSemantics,
  isChordInRange: boolean,
  isInActiveShape: boolean,
  hasChordOverlay: boolean,
  isHighlighted: boolean,
): string {
  if (!hasChordOverlay) {
    return classifyNote(
      sem.isScaleRoot, sem.isChordRoot, sem.isColorTone, isHighlighted,
      sem.isChordTone, hasChordOverlay, isChordInRange, isInActiveShape,
    );
  }

  if (sem.isChordRoot && sem.isChordTone && isChordInRange && isInActiveShape) return "chord-root";
  if (sem.isDiatonicChord && sem.isChordTone && isChordInRange && isInActiveShape) return "note-diatonic-chord";
  if (sem.isInScale && sem.isChordTone && isChordInRange && isInActiveShape) return "chord-tone-in-scale";
  if (sem.isInScale && sem.isColorTone && isInActiveShape && isHighlighted) return "color-tone";
  if (sem.isInScale && isInActiveShape && isHighlighted) return "scale-only";
  if (sem.isChordTone && isChordInRange && isInActiveShape) return "chord-tone-outside-scale";
  return "note-inactive";
}

type NoteShape = "circle" | "squircle" | "diamond" | "hexagon";

export type NoteVisuals = {
  radiusScale: number;
  noteShape: NoteShape;
};

export function getNoteVisuals(
  noteClass: string,
): NoteVisuals {
  switch (noteClass) {
    case "key-tonic":
      return {
        radiusScale: RADIUS_SCALE_KEY_TONIC,
        noteShape: "circle",
      };
    case "chord-root":
      return {
        radiusScale: RADIUS_SCALE_CHORD_ROOT,
        noteShape: "squircle",
      };
    case "chord-tone-in-scale":
      return {
        radiusScale: RADIUS_SCALE_CHORD_TONE,
        noteShape: "squircle",
      };
    case "note-active":
      return {
        radiusScale: RADIUS_SCALE_NOTE_ACTIVE,
        noteShape: "circle",
      };
    case "note-blue":
      return {
        radiusScale: RADIUS_SCALE_NOTE_ACTIVE,
        noteShape: "hexagon",
      };
    case "scale-only":
      return {
        radiusScale: RADIUS_SCALE_NOTE_ACTIVE,
        noteShape: "circle",
      };
    case "color-tone":
      return {
        radiusScale: RADIUS_SCALE_COLOR_TONE,
        noteShape: "hexagon",
      };
    case "chord-tone-outside-scale":
      return {
        radiusScale: RADIUS_SCALE_CHORD_TONE,
        noteShape: "diamond",
      };
    case "note-diatonic-chord":
      return {
        radiusScale: RADIUS_SCALE_CHORD_TONE,
        noteShape: "squircle",
      };
    default:
      return {
        radiusScale: RADIUS_SCALE_DEFAULT,
        noteShape: "circle",
      };
  }
}
