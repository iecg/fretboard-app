import {
  NOTES,
  ENHARMONICS,
  getNoteDisplayInScale,
  INTERVAL_NAMES,
  SCALES,
  getFretNoteWithOctave,
  parseNote,
  type NoteSemantics,
  type ShapePolygon,
  type CagedShape,
} from "@fretflow/core";
import type { ActiveShapeType } from "../../../hooks/useFretboardState";
import {
  classifyNote,
  classifyNoteFromSemantics,
  type BoxBound,
} from "../utils/semantics";
import type { NoteData } from "./useNoteData";
import { buildPolygonCoverage } from "../../../core/polygonCoverage";

export interface StaticFretboardTopologyNote extends NoteData {
  positionKey: string;
  isMatchedFullChordPosition: boolean;
  isInsideAnyPolygon: boolean;
  isChordInRange: boolean;
  isInActiveShape: boolean;
}

export interface UseStaticFretboardTopologyProps {
  numStrings: number;
  fretboardLayout: string[][];
  totalColumns: number;
  startFret: number;
  maxFret: number;

  highlightNotes: string[];
  hasChordOverlay: boolean;
  chordTones: string[];
  rootNote: string;
  chordRoot?: string;
  colorNotes: string[];
  shapePolygons: ShapePolygon[];
  chordFretSpread: number;
  activePattern?: "caged" | "3nps" | "none";
  shapeScope?: "single" | "multi" | "global";
  activeShape?: ActiveShapeType;
  scaleName: string;
  preferFlats: boolean;
  displayFormat?: "notes" | "degrees" | "none";
  wrappedNotes: Set<string>;
  tuning: string[];
  noteSemantics?: Map<string, NoteSemantics>;
  fullChordPositionKeys?: Set<string>;
  fullChordShapeByPosition?: Map<string, CagedShape>;
  chordBoxBounds: BoxBound[] | null;
}

const DEFAULT_LENS_EMPHASIS = { radiusBoost: 1, opacityBoost: 1 } as const;

export function buildStaticFretboardTopology({
  numStrings,
  fretboardLayout,
  totalColumns,
  startFret,
  maxFret,

  highlightNotes,
  hasChordOverlay,
  chordTones,
  rootNote,
  chordRoot,
  colorNotes,
  shapePolygons,
  chordFretSpread,
  activePattern,
  shapeScope,
  activeShape,
  scaleName,
  preferFlats,
  displayFormat,
  wrappedNotes,
  tuning,
  noteSemantics,
  fullChordPositionKeys,
  fullChordShapeByPosition,
  chordBoxBounds,
}: UseStaticFretboardTopologyProps): StaticFretboardTopologyNote[] {
  const notes: StaticFretboardTopologyNote[] = [];
  const scale = SCALES[scaleName] || [];
  const normRoot = rootNote && (rootNote.includes("b") && ENHARMONICS[rootNote]
    ? ENHARMONICS[rootNote]
    : rootNote);
  const rootIdx = rootNote ? NOTES.indexOf(normRoot.includes("#") ? normRoot : rootNote) : -1;

  const highlightSet = new Set(highlightNotes);
  const chordToneSet = new Set(chordTones);
  const colorNoteSet = new Set(colorNotes);
  const hasFullChordPositionFilter = !!fullChordPositionKeys && fullChordPositionKeys.size > 0;
  const polygonCoverage = buildPolygonCoverage(shapePolygons, maxFret);

  for (let stringIndex = 0; stringIndex < numStrings; stringIndex++) {
    const layoutRow = fretboardLayout[stringIndex];

    for (let idx = 0; idx <= totalColumns; idx++) {
      const fretIndex = startFret + idx;
      if (fretIndex >= maxFret) continue;

      const noteName = layoutRow[fretIndex];
      const positionKey = `${stringIndex}-${fretIndex}`;
      const isMatchedFullChordPosition =
        !hasFullChordPositionFilter || fullChordPositionKeys.has(positionKey);
      const fullChordShape = fullChordShapeByPosition?.get(positionKey);

      const isHighlighted =
        (highlightSet.has(noteName) || highlightSet.has(positionKey));

      const isChordTone =
        hasChordOverlay &&
        chordToneSet.has(noteName) &&
        isMatchedFullChordPosition;

      const isScaleRoot =
        (noteName === rootNote ||
          ENHARMONICS[noteName] === rootNote ||
          ENHARMONICS[rootNote] === noteName);

      const isChordRootNote =
        !!chordRoot &&
        isMatchedFullChordPosition &&
        (noteName === chordRoot ||
          ENHARMONICS[noteName] === chordRoot ||
          ENHARMONICS[chordRoot] === noteName);

      const isColorNote = !!(
        colorNoteSet.has(noteName) ||
        (ENHARMONICS[noteName] && colorNoteSet.has(ENHARMONICS[noteName]!))
      );

      const isInsideAnyPolygon = polygonCoverage.coveredPositions.has(positionKey);

      const isInPlayableContext = (() => {
        if (!hasChordOverlay) return false;
        if (chordBoxBounds === null) return true;

        if (hasFullChordPositionFilter && fullChordPositionKeys.has(positionKey)) {
          return true;
        }

        if (activePattern === "3nps" && shapeScope !== "global" && chordBoxBounds.length > 0) {
          const inFretRange = chordBoxBounds.some(
            (bounds) =>
              fretIndex >= bounds.minFret - chordFretSpread &&
              fretIndex <= bounds.maxFret + chordFretSpread,
          );
          if (!inFretRange) return false;
          if (highlightNotes.length > 0) {
            return highlightSet.has(positionKey);
          }
          return true;
        }

        if (shapePolygons.length === 0 || !activePattern) return true;
        if (shapeScope === "global") return true;

        return shapePolygons.some((poly) => {
          // Truncated polygons' visible portion is still a polygon the user
          // sees on the fretboard; positions inside it ARE in a playable
          // context. The clamped-vertex check below correctly filters to the
          // on-board fret range.
          if (shapeScope === "single") {
            if (activePattern === "caged" && poly.shape !== activeShape) return false;
            if (activePattern === "3nps" && poly.shape !== activeShape) return false;
          } else if (shapeScope === "multi" && Array.isArray(activeShape)) {
            if (!(activeShape as CagedShape[]).includes(poly.shape as CagedShape)) return false;
          }

          const leftFret = poly.vertices[stringIndex]?.fret;
          const rightFret = poly.vertices[poly.vertices.length - 1 - stringIndex]?.fret;
          if (leftFret === undefined || rightFret === undefined) return false;
          const clampedLeft = Math.min(maxFret, Math.max(0, leftFret));
          const clampedRight = Math.min(maxFret, Math.max(0, rightFret));
          if (clampedLeft > clampedRight) return false;

          return (
            fretIndex >= clampedLeft - chordFretSpread &&
            fretIndex <= clampedRight + chordFretSpread
          );
        });
      })();

      const isChordInRange = isInPlayableContext;
      const isInActiveShape = isInPlayableContext || !hasChordOverlay || !activePattern;

      const semantics = noteSemantics?.get(noteName);
      const effectiveSemantics = semantics && !isMatchedFullChordPosition
        ? {
            ...semantics,
            isChordRoot: false,
            isChordTone: false,
            isGuideTone: false,
            isTension: false,
            isDiatonicChord: false,
          }
        : semantics;

      const noteClass = effectiveSemantics
          ? classifyNoteFromSemantics(
              effectiveSemantics,
              isInActiveShape,
              hasChordOverlay,
              isHighlighted,
            )
          : classifyNote(
              isScaleRoot,
              isChordRootNote,
              isColorNote,
              isHighlighted,
              isChordTone,
              hasChordOverlay,
              isInActiveShape,
            );

      const finalNoteClass = noteClass;


      // Scale-aware spelled pitch (e.g. "A#" → "Bb" in F major). This is the
      // pitch the visible "notes"-mode label shows; the a11y aria-label reuses
      // it so screen readers announce the same spelling. See issue #493.
      const displayName = getNoteDisplayInScale(
        noteName,
        rootNote,
        scale,
        preferFlats,
      );
      let displayValue = displayName;
      if (displayFormat === "degrees" && rootNote) {
        const noteIdx = NOTES.indexOf(noteName);
        if (rootIdx !== -1 && noteIdx !== -1) {
          displayValue = INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
        }
      }

      const isWrapped = wrappedNotes.has(positionKey);
      const applyDimOpacity =
        (shapePolygons.length > 0 &&
          !isInsideAnyPolygon &&
          (finalNoteClass === "note-blue" ||
            finalNoteClass === "note-active" ||
            finalNoteClass === "scale-only" ||
            finalNoteClass === "chord-tone-outside-scale" ||
            finalNoteClass === "chord-tone-in-scale" ||
            finalNoteClass === "note-diatonic-chord" ||
            finalNoteClass === "chord-root" ||
            finalNoteClass === "chord-root-outside" ||
            finalNoteClass === "key-tonic")) ||
        (isWrapped && isHighlighted);

      const isHidden = finalNoteClass === "note-inactive";

      const openString = tuning[stringIndex];
      const noteWithOctave = openString
        ? getFretNoteWithOctave(openString, fretIndex)
        : `${noteName}4`;
      const octave = parseNote(noteWithOctave)?.octave ?? 4;

      notes.push({
        positionKey,
        stringIndex,
        fretIndex,
        noteName,
        octave,
        noteClass: finalNoteClass,
        displayName,
        displayValue,
        applyDimOpacity,
        applyLensEmphasis: DEFAULT_LENS_EMPHASIS,
        transitionRole: undefined,
        isInRegion: isInsideAnyPolygon || shapePolygons.length === 0,
        isHidden,
        isTension: effectiveSemantics?.isTension ?? false,
        isGuideTone: effectiveSemantics?.isGuideTone ?? false,
        fullChordShape,
        isMatchedFullChordPosition,
        isInsideAnyPolygon,
        isChordInRange,
        isInActiveShape,
      });
    }
  }

  return notes;
}
