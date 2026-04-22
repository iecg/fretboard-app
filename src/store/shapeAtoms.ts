import { atom } from "jotai";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  findMainShape,
  getShapeCenterFret,
  type ShapePolygon,
} from "../shapes";
import { getFretNote } from "../core/guitar";
import { getScaleNotes } from "../core/theory";
import type { ChordRowEntry } from "../core/theory";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  npsOctaveAtom,
  clickedShapeAtom,
} from "./fingeringAtoms";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleVisibleAtom,
  practiceBarColorNotesAtom,
} from "./scaleAtoms";
import {
  currentTuningAtom,
  fretStartAtom,
  fretEndAtom,
} from "./layoutAtoms";
import {
  chordTypeAtom,
  allChordMembersAtom,
  chordTonesAtom,
} from "./chordOverlayAtoms";

export const shapeDataAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const currentTuning = get(currentTuningAtom);
  const cagedShapes = get(cagedShapesAtom);
  const npsPosition = get(npsPositionAtom);
  const npsOctave = get(npsOctaveAtom);

  let coords: string[] = [];
  let bounds: { minFret: number; maxFret: number }[] = [];
  let polygons: ShapePolygon[] = [];
  const mergedWrappedNotes = new Set<string>();

  if (fingeringPattern === "caged") {
    const shapesToRender = CAGED_SHAPES.filter((s) => cagedShapes.has(s));
    const allCoords = new Set<string>();
    const allBounds: { minFret: number; maxFret: number }[] = [];
    const allPolygons: ShapePolygon[] = [];
    for (const shape of shapesToRender) {
      const res = getCagedCoordinates(
        rootNote,
        shape,
        scaleName,
        currentTuning,
        24,
      );
      res.coordinates.forEach((c) => allCoords.add(c));
      allBounds.push(...res.bounds);
      allPolygons.push(...res.polygons);
      res.wrappedNotes.forEach((kk) => mergedWrappedNotes.add(kk));
    }

    coords = Array.from(allCoords);
    bounds = allBounds;
    polygons = allPolygons;
  } else if (fingeringPattern === "3nps") {
    const res = get3NPSCoordinates(
      rootNote,
      scaleName,
      currentTuning,
      24,
      npsPosition,
      npsOctave,
    );
    coords = res.coordinates;
    bounds = res.bounds;
  } else {
    coords = getScaleNotes(rootNote, scaleName);
  }

  return {
    highlightNotes: coords,
    boxBounds: bounds,
    shapePolygons: polygons,
    wrappedNotes: mergedWrappedNotes,
  };
});

// Returns empty highlightNotes when scale is hidden; chord overlay remains active via chordTones.
export const effectiveShapeDataAtom = atom((get) => {
  const visible = get(scaleVisibleAtom);
  const data = get(shapeDataAtom);
  if (!visible) return { ...data, highlightNotes: [] as string[] };
  return data;
});

export interface AutoCenterTarget {
  centerFret: number;
  minFret: number;
  maxFret: number;
}

export const autoCenterTargetAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const { shapePolygons, boxBounds, wrappedNotes } = get(shapeDataAtom);
  const clickedShape = get(clickedShapeAtom);
  const startFret = get(fretStartAtom);
  const endFret = get(fretEndAtom);

  let target: AutoCenterTarget | undefined;

  if (fingeringPattern === "caged" && shapePolygons.length > 0) {
    if (clickedShape) {
      const clickedPoly = shapePolygons.find((p) => p.shape === clickedShape);
      if (clickedPoly && !clickedPoly.truncated) {
        target = {
          centerFret: getShapeCenterFret(clickedPoly),
          minFret: clickedPoly.intendedMin,
          maxFret: clickedPoly.intendedMax,
        };
      }
    }
    if (target === undefined) {
      const mainShape = findMainShape(
        shapePolygons,
        wrappedNotes,
        startFret,
        endFret,
      );
      if (mainShape) {
        target = {
          centerFret: getShapeCenterFret(mainShape),
          minFret: mainShape.intendedMin,
          maxFret: mainShape.intendedMax,
        };
      }
    }
  } else if (fingeringPattern === "3nps" && boxBounds.length > 0) {
    const lowestBounds = boxBounds.reduce((a, b) =>
      a.minFret <= b.minFret ? a : b,
    );
    target = {
      centerFret: (lowestBounds.minFret + lowestBounds.maxFret) / 2,
      minFret: lowestBounds.minFret,
      maxFret: lowestBounds.maxFret,
    };
  }

  return target;
});

export const isShapeLocalContextAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const cagedShapes = get(cagedShapesAtom);
  if (fingeringPattern === "3nps") return true;
  if (fingeringPattern === "caged" && cagedShapes.size === 1) return true;
  return false;
});

export const shapeContextLabelAtom = atom((get) => {
  const isShapeLocalContext = get(isShapeLocalContextAtom);
  if (!isShapeLocalContext) return null;

  const fingeringPattern = get(fingeringPatternAtom);
  if (fingeringPattern === "3nps") {
    const oct = get(npsOctaveAtom) === 0 ? "Low" : "High";
    return `In 3NPS position ${get(npsPositionAtom)} (${oct})`;
  }
  if (fingeringPattern === "caged") {
    const shape = Array.from(get(cagedShapesAtom))[0];
    return shape ? `In ${shape} shape` : null;
  }
  return null;
});

export const shapeHighlightedNoteSetAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const { highlightNotes } = get(shapeDataAtom);
  const currentTuning = get(currentTuningAtom);

  if (fingeringPattern === "all") return null;
  const noteSet = new Set<string>();
  for (const coord of highlightNotes) {
    const dashIdx = coord.indexOf("-");
    if (dashIdx === -1) continue; // note name, not a coord
    const stringIdx = parseInt(coord.slice(0, dashIdx), 10);
    const fretIdx = parseInt(coord.slice(dashIdx + 1), 10);
    const openNote = currentTuning[stringIdx];
    if (openNote) noteSet.add(getFretNote(openNote, fretIdx));
  }
  return noteSet;
});

export const shapeLocalTargetMembersAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const chordType = get(chordTypeAtom);
  const allChordMembers = get(allChordMembersAtom);
  if (!shapeHighlightedNoteSet || !chordType) return [] as ChordRowEntry[];
  return allChordMembers.filter((m) =>
    shapeHighlightedNoteSet.has(m.internalNote),
  );
});

export const shapeLocalOutsideMembersAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const chordType = get(chordTypeAtom);
  const allChordMembers = get(allChordMembersAtom);
  if (!shapeHighlightedNoteSet || !chordType) return [] as ChordRowEntry[];
  return allChordMembers.filter((m) =>
    !m.inScale && shapeHighlightedNoteSet.has(m.internalNote),
  );
});

export const shapeLocalColorNotesFilteredAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const chordTones = get(chordTonesAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);

  if (!shapeHighlightedNoteSet) return [] as typeof practiceBarColorNotes;

  const chordToneSet = new Set(chordTones);
  return practiceBarColorNotes.filter(
    (n) =>
      shapeHighlightedNoteSet.has(n.internalNote) &&
      !chordToneSet.has(n.internalNote),
  );
});

export const shapeLocalColorNotesAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);
  if (!shapeHighlightedNoteSet) return [] as typeof practiceBarColorNotes;
  return practiceBarColorNotes.filter((n) =>
    shapeHighlightedNoteSet.has(n.internalNote),
  );
});
