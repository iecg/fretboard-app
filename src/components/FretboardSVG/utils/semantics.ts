import type { PracticeLens, NoteSemantics } from "../../../core/theory";
import type { ShapePolygon } from "../../../shapes";
import {
  RADIUS_SCALE_KEY_TONIC,
  RADIUS_SCALE_CHORD_ROOT,
  RADIUS_SCALE_CHORD_TONE,
  RADIUS_SCALE_NOTE_ACTIVE,
  RADIUS_SCALE_COLOR_TONE,
  RADIUS_SCALE_DEFAULT,
} from "../../../core/constants";

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

  switch (practiceLens) {
    case "guide-tones":
      if (isGuideTone) {
        return { glowColor: "cyan", radiusBoost: 1.15, opacityBoost: 1 };
      }
      if (noteClass.includes("chord-") || noteClass.includes("color-")) {
        return { radiusBoost: 0.85, opacityBoost: 0.7 };
      }
      return defaultEmphasis;

    case "tension":
      if (isTension) {
        return { glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 };
      }
      if (noteClass.includes("chord-")) {
        return { radiusBoost: 0.85, opacityBoost: 0.7 };
      }
      return defaultEmphasis;

    case "targets":
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
  shapePolygons: ShapePolygon[],
  boxBounds: BoxBound[],
  fretIndex: number,
): string {
  if (!hasChordOverlay) {
    if (isScaleRoot && isHighlighted) return "key-tonic";
    if (isColorNote && isHighlighted) return "note-blue";
    if (isHighlighted) return "note-active";
    if (
      isColorNote &&
      shapePolygons.length > 0 &&
      boxBounds.some(
        (b) => fretIndex >= b.minFret - 1 && fretIndex <= b.maxFret + 1,
      )
    )
      return "note-blue";
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
  shapePolygons: ShapePolygon[],
  boxBounds: BoxBound[],
  fretIndex: number,
): string {
  if (!hasChordOverlay) {
    return classifyNote(
      sem.isScaleRoot, sem.isChordRoot, sem.isColorTone, isHighlighted,
      sem.isChordTone, hasChordOverlay, isChordInRange, isInActiveShape, shapePolygons, boxBounds, fretIndex,
    );
  }

  if (sem.isChordRoot && sem.isChordTone && isChordInRange && isInActiveShape) return "chord-root";
  if (sem.isInScale && sem.isChordTone && isChordInRange && isInActiveShape) return "chord-tone-in-scale";
  if (sem.isInScale && sem.isColorTone && isInActiveShape && isHighlighted) return "color-tone";
  if (sem.isInScale && isInActiveShape && isHighlighted) return "scale-only";
  if (sem.isChordTone && isChordInRange && isInActiveShape) return "chord-tone-outside-scale";
  return "note-inactive";
}

export type NoteShape = "circle" | "squircle" | "diamond" | "hexagon";

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
    default:
      return {
        radiusScale: RADIUS_SCALE_DEFAULT,
        noteShape: "circle",
      };
  }
}
