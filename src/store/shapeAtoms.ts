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
import {
  getOneStringCoordinates,
  getTwoStringsCoordinates,
  getDoubleStopsCoordinates,
  getBox2x4Coordinates,
  getBox3x3Coordinates,
  getStackCoordinates,
} from "../shapes/practicePatterns";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  npsOctaveAtom,
  clickedShapeAtom,
  oneStringIndexAtom,
  twoStringsPairAtom,
  doubleStopsIntervalAtom,
  box2x4StartFretAtom,
  box2x4PairAtom,
  box3x3StartFretAtom,
  box3x3TrioAtom,
  stackStartFretAtom,
} from "./fingeringAtoms";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleVisibleAtom,
} from "./scaleAtoms";
import {
  currentTuningAtom,
  fretStartAtom,
  fretEndAtom,
} from "./layoutAtoms";

export const shapeDataAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const currentTuning = get(currentTuningAtom);
  const cagedShapes = get(cagedShapesAtom);
  const npsPosition = get(npsPositionAtom);
  const npsOctave = get(npsOctaveAtom);
  const oneStringIndex = get(oneStringIndexAtom);
  const twoStringsPair = get(twoStringsPairAtom);
  const doubleStopsInterval = get(doubleStopsIntervalAtom);
  const box2x4StartFret = get(box2x4StartFretAtom);
  const box2x4Pair = get(box2x4PairAtom);
  const box3x3StartFret = get(box3x3StartFretAtom);
  const box3x3Trio = get(box3x3TrioAtom);
  const stackStartFret = get(stackStartFretAtom);

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
  } else if (fingeringPattern === "one-string") {
    coords = getOneStringCoordinates(rootNote, scaleName, currentTuning, 24, oneStringIndex);
  } else if (fingeringPattern === "two-strings") {
    coords = getTwoStringsCoordinates(rootNote, scaleName, currentTuning, 24, twoStringsPair);
  } else if (fingeringPattern === "double-stops") {
    coords = getDoubleStopsCoordinates(rootNote, scaleName, currentTuning, 24, doubleStopsInterval);
  } else if (fingeringPattern === "box-2x4") {
    coords = getBox2x4Coordinates(rootNote, scaleName, currentTuning, 24, box2x4StartFret, box2x4Pair);
  } else if (fingeringPattern === "box-3x3") {
    coords = getBox3x3Coordinates(rootNote, scaleName, currentTuning, 24, box3x3StartFret, box3x3Trio);
  } else if (fingeringPattern === "stack") {
    coords = getStackCoordinates(rootNote, scaleName, currentTuning, 24, stackStartFret);
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

export const shapeHighlightedNoteSetAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const { highlightNotes } = get(shapeDataAtom);
  const currentTuning = get(currentTuningAtom);

  if (fingeringPattern === "none") return null;
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
