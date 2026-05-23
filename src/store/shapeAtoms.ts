import { atom } from "jotai";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  findMainShape,
  getShapeCenterFret,
  type ShapePolygon,
} from "@fretflow/core";
import { getFretNote, getFretboardNotes } from "@fretflow/core";
import { getScaleNotes, NOTES } from "@fretflow/core";
import {
  getOneStringCoordinates,
  getTwoStringsCoordinates,
  getTwoStringsIntervalPairs,
  TWO_STRINGS_INTERVAL_SD_DISTANCES,
  getOneStringIntervalPairs,
} from "@fretflow/core";
import {
  fingeringPatternAtom,
  cagedShapesAtom,
  cagedOctaveAtom,
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

export interface ShapeData {
  highlightNotes: string[];
  boxBounds: { minFret: number; maxFret: number }[];
  shapePolygons: ShapePolygon[];
  wrappedNotes: Set<string>;
  intervalPairs: Array<{ a: string; b: string }>;
}

const cagedShapeDataAtom = atom((get): ShapeData => {
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const currentTuning = get(currentTuningAtom);
  const cagedShapes = get(cagedShapesAtom);
  const cagedOctave = get(cagedOctaveAtom);

  const shapesToRender = CAGED_SHAPES.filter((s) => cagedShapes.has(s));
  const singleShapeMode = cagedShapes.size === 1;
  const allCoords = new Set<string>();
  const allBounds: { minFret: number; maxFret: number }[] = [];
  const allPolygons: ShapePolygon[] = [];
  const mergedWrappedNotes = new Set<string>();

  for (const shape of shapesToRender) {
    const res = getCagedCoordinates(rootNote, shape, scaleName, currentTuning, 24);

    if (singleShapeMode && res.polygons.length > 1) {
      // Slice to the chosen octave; clamp index to available range.
      const idx = Math.min(cagedOctave, res.polygons.length - 1);
      const chosenBounds = res.bounds[idx]!;
      allPolygons.push(res.polygons[idx]!);
      allBounds.push(chosenBounds);
      // Keep only coordinates that fall within the chosen octave's fret bounds.
      for (const coord of res.coordinates) {
        const fret = parseInt(coord.split("-")[1], 10);
        if (fret >= chosenBounds.minFret && fret <= chosenBounds.maxFret) {
          allCoords.add(coord);
        }
      }
    } else {
      res.coordinates.forEach((c) => allCoords.add(c));
      allBounds.push(...res.bounds);
      allPolygons.push(...res.polygons);
    }

    res.wrappedNotes.forEach((kk) => mergedWrappedNotes.add(kk));
  }

  return {
    highlightNotes: Array.from(allCoords),
    boxBounds: allBounds,
    shapePolygons: allPolygons,
    wrappedNotes: mergedWrappedNotes,
    intervalPairs: [],
  };
});

const threeNpsShapeDataAtom = atom((get): ShapeData => {
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const currentTuning = get(currentTuningAtom);
  const npsPosition = get(npsPositionAtom);
  const npsOctave = get(npsOctaveAtom);

  const res = get3NPSCoordinates(rootNote, scaleName, currentTuning, 24, npsPosition, npsOctave);

  return {
    highlightNotes: res.coordinates,
    boxBounds: res.bounds,
    shapePolygons: [],
    wrappedNotes: new Set<string>(),
    intervalPairs: [],
  };
});

const oneStringShapeDataAtom = atom((get): ShapeData => {
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const currentTuning = get(currentTuningAtom);
  const oneStringIndex = get(oneStringIndexAtom);
  const oneStringInterval = get(oneStringIntervalAtom);

  // Always emit full string coords (visibility independent of interval — UAT-10 model).
  const coords = getOneStringCoordinates(rootNote, scaleName, currentTuning, 24, oneStringIndex);
  let intervalPairs: Array<{ a: string; b: string }> = [];

  if (oneStringInterval > 0) {
    // UAT-22: On mode connects consecutive scale tones (2nds) only — SD distance = 1.
    const board = getFretboardNotes(currentTuning, 24);
    const scaleNoteNames = getScaleNotes(rootNote, scaleName);
    const scaleNoteSet = new Set(scaleNoteNames);
    const scaleNoteSemitones = scaleNoteNames.map((n) => NOTES.indexOf(n)).filter((i) => i !== -1);
    intervalPairs = getOneStringIntervalPairs(
      oneStringIndex,
      board,
      scaleNoteSet,
      scaleNoteSemitones,
      1, // SD distance = 1 → scale 2nds (consecutive scale tones)
      currentTuning,
    );
  }

  return {
    highlightNotes: coords,
    boxBounds: [],
    shapePolygons: [],
    wrappedNotes: new Set<string>(),
    intervalPairs,
  };
});

const twoStringsShapeDataAtom = atom((get): ShapeData => {
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const currentTuning = get(currentTuningAtom);
  const twoStringsInterval = get(twoStringsIntervalAtom);
  const activePairTuple = get(twoStringsActivePairTupleAtom);

  // Always emit the full pair note set regardless of interval setting (UAT-10).
  // Visibility is decoupled from interval — interval only affects connector lines.
  // activePairTuple handles adjacent-vs-skip-one topology (Option X).
  const coords = getTwoStringsCoordinates(rootNote, scaleName, currentTuning, 24, activePairTuple);
  let intervalPairs: Array<{ a: string; b: string }> = [];

  if (twoStringsInterval > 0) {
    const board = getFretboardNotes(currentTuning, 24);
    const scaleNoteNames = getScaleNotes(rootNote, scaleName);
    const scaleNoteSet = new Set(scaleNoteNames);
    const scaleNoteSemitones = scaleNoteNames.map((n) => NOTES.indexOf(n)).filter((i) => i !== -1);
    const targetSdDist = TWO_STRINGS_INTERVAL_SD_DISTANCES[twoStringsInterval - 1] ?? 2;
    intervalPairs = getTwoStringsIntervalPairs(activePairTuple, board, scaleNoteSet, scaleNoteSemitones, targetSdDist, currentTuning);
  }

  return {
    highlightNotes: coords,
    boxBounds: [],
    shapePolygons: [],
    wrappedNotes: new Set<string>(),
    intervalPairs,
  };
});

export const shapeDataAtom = atom((get): ShapeData => {
  const fingeringPattern = get(fingeringPatternAtom);
  switch (fingeringPattern) {
    case "caged": return get(cagedShapeDataAtom);
    case "3nps": return get(threeNpsShapeDataAtom);
    case "one-string": return get(oneStringShapeDataAtom);
    case "two-strings": return get(twoStringsShapeDataAtom);
    default: {
      const rootNote = get(rootNoteAtom);
      const scaleName = get(scaleNameAtom);
      // Subscribe to currentTuningAtom so tuningNameAtom is always initialized on first render.
      get(currentTuningAtom);
      return {
        highlightNotes: getScaleNotes(rootNote, scaleName),
        boxBounds: [],
        shapePolygons: [],
        wrappedNotes: new Set<string>(),
        intervalPairs: [],
      };
    }
  }
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

export const intervalPairsAtom = atom((get) => get(effectiveShapeDataAtom).intervalPairs);

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
