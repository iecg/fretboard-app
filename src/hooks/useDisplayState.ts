import { useState, useMemo } from "react";
import {
  useAtom,
  useAtomValue,
  useSetAtom,
} from "jotai";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  hideNonChordNotesAtom,
  chordFretSpreadAtom,
  chordIntervalFilterAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  fretStartAtom,
  fretEndAtom,
  displayFormatAtom,
  shapeLabelsAtom,
  tuningNameAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  setRootNoteAtom,
} from "../store/atoms";
import {
  SCALES,
  NOTES,
  CHORDS,
  getScaleNotes,
  getChordNotes,
  getIntervalNotes,
  getNoteDisplay,
  getNoteDisplayInScale,
  getDivergentNotes,
  formatAccidental,
  resolveAccidentalMode,
} from "../theory";
import { STANDARD_TUNING, TUNINGS } from "../guitar";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  findMainShape,
  getShapeCenterFret,
  type ShapePolygon,
  type CagedShape,
} from "../shapes";

// Chord interval filter presets — sets of allowed semitone intervals from chord root
export const CHORD_INTERVAL_FILTERS: Record<string, Set<number>> = {
  All: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  Triad: new Set([0, 3, 4, 6, 7, 8]),
  "7th Chord": new Set([0, 3, 4, 6, 7, 8, 10, 11]),
  "Power Chord": new Set([0, 7]),
  "Guide Tones": new Set([3, 4, 10, 11]),
  "Shell Voicing": new Set([0, 3, 4, 10, 11]),
  "Root & 3rd": new Set([0, 3, 4]),
  "Root & 5th": new Set([0, 6, 7, 8]),
  "Root & 7th": new Set([0, 10, 11]),
  "3rd & 5th": new Set([3, 4, 6, 7, 8]),
  "3rd & 7th": new Set([3, 4, 10, 11]),
};

export const CHORD_FILTER_OPTIONS = Object.keys(CHORD_INTERVAL_FILTERS);

export default function useDisplayState() {
  // Scale
  const rootNote = useAtomValue(rootNoteAtom);
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);

  // Chord overlay
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [hideNonChordNotes, setHideNonChordNotes] = useAtom(hideNonChordNotesAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const [chordIntervalFilter, setChordIntervalFilter] = useAtom(chordIntervalFilterAtom);

  // Fingering
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);

  // Fret range (for auto-center calculation)
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);

  // Display
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [shapeLabels, setShapeLabels] = useAtom(shapeLabelsAtom);
  const tuningName = useAtomValue(tuningNameAtom);

  // Accidentals
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  // Root note setter (write atom for CoF root selection — syncs chordRoot when linked)
  const setRootNote = useSetAtom(setRootNoteAtom);

  // Internalized local state
  const [clickedShape, setClickedShape] = useState<CagedShape | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  // Callbacks
  const onShapeClick = (shape: CagedShape | null) => {
    setClickedShape(shape);
  };

  const onRecenter = () => {
    setRecenterKey((k) => k + 1);
  };

  // useMemo derivations (copied verbatim from App.tsx)

  const useFlats = useMemo(
    () => resolveAccidentalMode(rootNote, scaleName, accidentalMode),
    [rootNote, scaleName, accidentalMode],
  );

  const currentTuning = TUNINGS[tuningName] || STANDARD_TUNING;

  // Compute active chord tones (independent of scale)
  const chordTones = useMemo(() => {
    if (!chordType) return [];
    return getChordNotes(chordRoot, chordType);
  }, [chordRoot, chordType]);

  // Apply interval filter to chord tones (always preserve root)
  const filteredChordTones = useMemo(() => {
    if (!chordType || chordIntervalFilter === "All") return chordTones;
    const allowed = CHORD_INTERVAL_FILTERS[chordIntervalFilter];
    const intervals = CHORDS[chordType];
    if (!intervals || !allowed) return chordTones;
    const filtered = intervals.filter((i) => allowed.has(i));
    // Always include root (interval 0) so root-active classification stays anchored
    if (!filtered.includes(0)) filtered.unshift(0);
    return getIntervalNotes(chordRoot, filtered);
  }, [chordRoot, chordType, chordIntervalFilter, chordTones]);

  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes, autoCenterTarget } =
    useMemo(() => {
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
          res.wrappedNotes.forEach((k) => mergedWrappedNotes.add(k));
        }

        coords = Array.from(allCoords);
        bounds = allBounds;
        polygons = allPolygons;
      } else if (fingeringPattern === "3nps") {
        if (npsPosition === 0) {
          coords = getScaleNotes(rootNote, scaleName);
        } else {
          const res = get3NPSCoordinates(
            rootNote,
            scaleName,
            currentTuning,
            24,
            npsPosition,
          );
          coords = res.coordinates;
          bounds = res.bounds;
        }
      } else {
        coords = getScaleNotes(rootNote, scaleName);
      }

      // Compute auto-center target for CAGED mode
      let autoCenterTarget: number | undefined;
      if (fingeringPattern === "caged" && polygons.length > 0) {
        // If a shape was clicked, center that specific shape
        if (clickedShape) {
          const clickedPoly = polygons.find((p) => p.shape === clickedShape);
          if (clickedPoly && !clickedPoly.truncated) {
            autoCenterTarget = getShapeCenterFret(clickedPoly);
          }
        }
        // Otherwise find the main (lowest complete) shape
        if (autoCenterTarget === undefined) {
          const mainShape = findMainShape(polygons, mergedWrappedNotes, startFret, endFret);
          if (mainShape) {
            autoCenterTarget = getShapeCenterFret(mainShape);
          }
        }
      }

      return {
        highlightNotes: coords,
        boxBounds: bounds,
        shapePolygons: polygons,
        wrappedNotes: mergedWrappedNotes,
        autoCenterTarget,
      };
    }, [
      rootNote,
      scaleName,
      fingeringPattern,
      cagedShapes,
      npsPosition,
      currentTuning,
      startFret,
      endFret,
      clickedShape,
    ]);

  // Compute color notes: blue notes for blues scales, divergent notes for modal scales
  const colorNotes = useMemo(() => {
    const intervals = SCALES[scaleName];
    if (!intervals) return [];
    // Minor Blues: blue note is b5 (interval 6)
    if (scaleName === "Minor Blues") {
      const rootIdx = NOTES.indexOf(rootNote);
      return rootIdx >= 0 ? [NOTES[(rootIdx + 6) % 12]] : [];
    }
    // Major Blues: blue note is b3 (interval 3)
    if (scaleName === "Major Blues") {
      const rootIdx = NOTES.indexOf(rootNote);
      return rootIdx >= 0 ? [NOTES[(rootIdx + 3) % 12]] : [];
    }
    // Modal scales: notes that diverge from the reference major/minor
    return getDivergentNotes(rootNote, scaleName);
  }, [rootNote, scaleName]);

  const summaryNotes = useMemo(
    () => getScaleNotes(rootNote, scaleName),
    [rootNote, scaleName],
  );

  const scaleLabel = `${formatAccidental(getNoteDisplayInScale(rootNote, rootNote, SCALES[scaleName] || [], useFlats))} ${scaleName}`;

  const chordLabel = chordType
    ? `${formatAccidental(getNoteDisplay(chordRoot, chordRoot, useFlats))} ${chordType}`
    : null;

  const chordSummaryNotes = useMemo(() => {
    if (!chordType || chordTones.length === 0) return [];
    const chordRootIdx = NOTES.indexOf(chordRoot);
    const chordToneSet = new Set(chordTones);
    return NOTES.slice(chordRootIdx)
      .concat(NOTES.slice(0, chordRootIdx))
      .filter((n) => chordToneSet.has(n));
  }, [chordType, chordTones, chordRoot]);

  return {
    // Atom values
    rootNote,
    scaleName,
    chordRoot,
    chordType,
    linkChordRoot,
    hideNonChordNotes,
    chordFretSpread,
    chordIntervalFilter,
    fingeringPattern,
    cagedShapes,
    npsPosition,
    startFret,
    endFret,
    displayFormat,
    shapeLabels,
    tuningName,
    accidentalMode,
    enharmonicDisplay,
    // Setters
    setScaleName,
    setChordRoot,
    setChordType,
    setLinkChordRoot,
    setHideNonChordNotes,
    setChordIntervalFilter,
    setFingeringPattern,
    setCagedShapes,
    setNpsPosition,
    setDisplayFormat,
    setShapeLabels,
    setRootNote,
    // Derived values
    useFlats,
    currentTuning,
    chordTones,
    filteredChordTones,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    colorNotes,
    summaryNotes,
    scaleLabel,
    chordLabel,
    chordSummaryNotes,
    // Internal state + callbacks
    clickedShape,
    recenterKey,
    onShapeClick,
    onRecenter,
  };
}
