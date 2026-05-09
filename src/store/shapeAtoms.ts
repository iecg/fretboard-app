import { atom } from "jotai";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  findMainShape,
  getShapeCenterFret,
  type ShapePolygon,
} from "../shapes";
import { getFretNote, getFretboardNotes } from "../core/guitar";
import { getScaleNotes, getScaleSemitones } from "../core/theory";
import {
  getOneStringCoordinates,
  getTwoStringsCoordinates,
  getTwoStringsIntervalPairs,
  TWO_STRINGS_INTERVAL_SD_DISTANCES,
  getOneStringIntervalPairs,
} from "../shapes/practicePatterns";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  npsOctaveAtom,
  clickedShapeAtom,
  oneStringIndexAtom,
  oneStringIntervalAtom,
  twoStringsIntervalAtom,
  twoStringsActivePairTupleAtom,
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
  const oneStringInterval = get(oneStringIntervalAtom);
  const twoStringsInterval = get(twoStringsIntervalAtom);
  const activePairTuple = get(twoStringsActivePairTupleAtom);

  let coords: string[] = [];
  let bounds: { minFret: number; maxFret: number }[] = [];
  let polygons: ShapePolygon[] = [];
  let intervalPairs: Array<{ a: string; b: string }> = [];
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
    // Always emit full string coords (visibility independent of interval — UAT-10 model).
    coords = getOneStringCoordinates(rootNote, scaleName, currentTuning, 24, oneStringIndex);
    if (oneStringInterval > 0) {
      // UAT-22: On mode connects consecutive scale tones (2nds) only — SD distance = 1.
      const board = getFretboardNotes(currentTuning, 24);
      const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
      const scaleNoteSemitones = getScaleSemitones(rootNote, scaleName);
      intervalPairs = getOneStringIntervalPairs(
        oneStringIndex,
        board,
        scaleNoteSet,
        scaleNoteSemitones,
        1, // SD distance = 1 → scale 2nds (consecutive scale tones)
        currentTuning,
      );
    }
  } else if (fingeringPattern === "two-strings") {
    // Always emit the full pair note set regardless of interval setting (UAT-10).
    // Visibility is decoupled from interval — interval only affects connector lines.
    // activePairTuple handles adjacent-vs-skip-one topology (Option X).
    coords = getTwoStringsCoordinates(rootNote, scaleName, currentTuning, 24, activePairTuple);
    if (twoStringsInterval > 0) {
      const board = getFretboardNotes(currentTuning, 24);
      const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
      const scaleNoteSemitones = getScaleSemitones(rootNote, scaleName);
      const targetSdDist = TWO_STRINGS_INTERVAL_SD_DISTANCES[twoStringsInterval - 1] ?? 2;
      intervalPairs = getTwoStringsIntervalPairs(activePairTuple, board, scaleNoteSet, scaleNoteSemitones, targetSdDist, currentTuning);
    }
  } else {
    coords = getScaleNotes(rootNote, scaleName);
  }

  return {
    highlightNotes: coords,
    boxBounds: bounds,
    shapePolygons: polygons,
    wrappedNotes: mergedWrappedNotes,
    intervalPairs,
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
