import type { PracticeLens, NoteSemantics } from "@fretflow/core";
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

export function getLensEmphasis(
  noteClass: string,
  practiceLens: PracticeLens | undefined,
  isGuideTone: boolean,
  isTension: boolean,
): LensEmphasis {
  const defaultEmphasis: LensEmphasis = { radiusBoost: 1, opacityBoost: 1 };

  if (!practiceLens) return defaultEmphasis;

  // TODO (Task 4.4/4.5): rewrite emphasis logic for new lens IDs.
  // Temporary bridge: "tones" uses old guide-tones emphasis; "lead" uses old tension emphasis.
  switch (practiceLens) {
    case "tones":
      if (isGuideTone) {
        return { glowColor: "cyan", radiusBoost: 1.15, opacityBoost: 1 };
      }
      if (noteClass.includes("chord-") || noteClass.includes("color-") || noteClass === "note-diatonic-chord") {
        return { radiusBoost: 0.85, opacityBoost: 0.7 };
      }
      return defaultEmphasis;

    case "lead":
      if (isTension) {
        return { glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 };
      }
      if (noteClass.includes("chord-") || noteClass === "note-diatonic-chord") {
        return { radiusBoost: 0.85, opacityBoost: 0.7 };
      }
      return defaultEmphasis;

    default:
      return defaultEmphasis;
  }
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
      // Phase 04: use chord-tone-in-scale visuals as fallback; Phase 05+ adds distinct styling
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
