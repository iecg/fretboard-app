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

export type TransitionRole = "held" | "incoming" | "departing";

export type LensEmphasis = {
  glowColor?: `var(--${string})`;
  radiusBoost: number;
  opacityBoost: number;
  /** Discrete voice-leading role during the lead-in window; undefined = static. */
  transitionRole?: TransitionRole;
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
  /** Guide tones (3rd/7th) of the next chord — kept for clarity / future use. */
  nextGuideTones: Set<string>;
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

  const {
    notePc,
    commonWithNext,
    incomingTones,
    departingTones,
    leadInActive,
  } = leadContext;

  const isCurrentChordTone = CHORD_TONE_CLASSES.has(noteClass);

  if (leadInActive) {
    // 1. Incoming: a pitch the next chord introduces. Ghost-ring preview.
    if (incomingTones.has(notePc)) {
      return {
        glowColor: "var(--note-incoming)",
        radiusBoost: 1,
        opacityBoost: 1,
        transitionRole: "incoming",
      };
    }
    // 2. Departing: a current chord tone the next chord drops. Calm dim.
    if (isCurrentChordTone && departingTones.has(notePc)) {
      return { radiusBoost: 0.95, opacityBoost: 0.8, transitionRole: "departing" };
    }
    // 3. Held: a current chord tone that carries through. Steady, no pulse.
    if (isCurrentChordTone && commonWithNext.has(notePc)) {
      return {
        glowColor: "var(--note-glow-hold)",
        radiusBoost: 1.15,
        opacityBoost: 1,
        transitionRole: "held",
      };
    }
  }

  // 4. Static: held chord tones outside the window keep a gentle hold glow.
  if (isCurrentChordTone && commonWithNext.has(notePc)) {
    return { glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 };
  }
  return applyTonesBase(noteClass, isGuideTone);
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

  if (sem.isChordRoot && sem.isChordTone && isInActiveShape) return "chord-root";
  if (sem.isDiatonicChord && sem.isChordTone && isInActiveShape) return "note-diatonic-chord";
  if (sem.isInScale && sem.isChordTone && isInActiveShape) return "chord-tone-in-scale";
  if (sem.isInScale && sem.isColorTone && isInActiveShape && isHighlighted) return "color-tone";
  if (sem.isInScale && isInActiveShape && isHighlighted) return "scale-only";
  if (sem.isChordTone && isInActiveShape) return "chord-tone-outside-scale";
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
