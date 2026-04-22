import { useMemo } from "react";
import {
  NOTES,
  ENHARMONICS,
  getNoteDisplayInScale,
  INTERVAL_NAMES,
  SCALES,
  type PracticeLens,
  type NoteSemantics,
} from "../../../core/theory";
import type { ShapePolygon, CagedShape } from "../../../shapes";
import type { ActiveShapeType } from "../../../hooks/useFretboardState";
import {
  getLensEmphasis,
  classifyNote,
  classifyNoteFromSemantics,
  type BoxBound,
  type LensEmphasis,
} from "../utils/semantics";

export interface NoteData {
  stringIndex: number;
  fretIndex: number;
  noteName: string;
  noteClass: string;
  displayValue: string;
  applyDimOpacity: boolean;
  applyLensEmphasis: LensEmphasis;
  isHidden: boolean;
  isTension: boolean;
  isGuideTone: boolean;
}

export interface UseNoteDataProps {
  numStrings: number;
  fretboardLayout: string[][];
  totalColumns: number;
  startFret: number;
  maxFret: number;
  hiddenNotes?: Set<string>;
  highlightNotes: string[];
  hasChordOverlay: boolean;
  chordTones: string[];
  rootNote: string;
  chordRoot?: string;
  colorNotes: string[];
  shapePolygons: ShapePolygon[];
  boxBounds: BoxBound[];
  chordFretSpread: number;
  activePattern?: "caged" | "3nps" | "all";
  shapeScope?: "single" | "multi" | "global";
  activeShape?: ActiveShapeType;
  scaleName: string;
  useFlats: boolean;
  displayFormat?: "notes" | "degrees" | "none";
  wrappedNotes: Set<string>;
  practiceLens?: PracticeLens;
  tuning: string[];
  noteSemantics?: Map<string, NoteSemantics>;
}

export function useNoteData({
  numStrings,
  fretboardLayout,
  totalColumns,
  startFret,
  maxFret,
  hiddenNotes,
  highlightNotes,
  hasChordOverlay,
  chordTones,
  rootNote,
  chordRoot,
  colorNotes,
  shapePolygons,
  boxBounds,
  chordFretSpread,
  activePattern,
  shapeScope,
  activeShape,
  scaleName,
  useFlats,
  displayFormat,
  wrappedNotes,
  practiceLens,
  wrappedNotes,
  practiceLens,
  noteSemantics,
}: UseNoteDataProps): NoteData[] {
  noteSemantics,
}: UseNoteDataProps): NoteData[] {
  return useMemo(() => {
    const notes: NoteData[] = [];
    const scale = SCALES[scaleName] || [];
    const normRoot = rootNote && (rootNote.includes("b") && ENHARMONICS[rootNote]
      ? ENHARMONICS[rootNote]
      : rootNote);
    const rootIdx = rootNote ? NOTES.indexOf(normRoot.includes("#") ? normRoot : rootNote) : -1;

    // Pre-calculate normalized hidden notes for faster lookup
    const normalizedHidden = new Set<string>();
    if (hiddenNotes && hiddenNotes.size > 0) {
      hiddenNotes.forEach(n => {
        normalizedHidden.add(n);
        // Also hide enharmonic equivalents if it's a note name
        const enh = ENHARMONICS[n];
        if (enh) normalizedHidden.add(enh);
      });
    }

    // Pre-calculate highlighted notes set for faster lookup
    const highlightSet = new Set(highlightNotes);

    // Pre-calculate chord tones set
    const chordToneSet = new Set(chordTones);

    // Pre-calculate color notes set
    const colorNoteSet = new Set(colorNotes);

    for (let stringIndex = 0; stringIndex < numStrings; stringIndex++) {
      const layoutRow = fretboardLayout[stringIndex];

      for (let idx = 0; idx <= totalColumns; idx++) {
        const fretIndex = startFret + idx;
        if (fretIndex >= maxFret) continue;

        const noteName = layoutRow[fretIndex];

        const isNoteHidden = normalizedHidden.has(noteName) || normalizedHidden.has(`${stringIndex}-${fretIndex}`);

        const isHighlighted =
          !isNoteHidden &&
          (highlightSet.has(noteName) ||
            highlightSet.has(`${stringIndex}-${fretIndex}`));
        
        const isChordTone =
          !isNoteHidden && hasChordOverlay && chordToneSet.has(noteName);
        
        const isScaleRoot =
          !isNoteHidden &&
          (noteName === rootNote ||
            ENHARMONICS[noteName] === rootNote ||
            ENHARMONICS[rootNote] === noteName);
        
        const isChordRootNote =
          !isNoteHidden &&
          !!chordRoot &&
          (noteName === chordRoot ||
            ENHARMONICS[noteName] === chordRoot ||
            ENHARMONICS[chordRoot] === noteName);
        
        const isColorNote = !!(!isNoteHidden && colorNoteSet.size > 0 && (
          colorNoteSet.has(noteName) || 
          (ENHARMONICS[noteName] && colorNoteSet.has(ENHARMONICS[noteName]!))
        ));

        const isInsideAnyPolygon = shapePolygons.some((poly) => {
          const leftFret = poly.vertices[stringIndex]?.fret;
          const rightFret =
            poly.vertices[poly.vertices.length - 1 - stringIndex]?.fret;
          return (
            leftFret !== undefined &&
            rightFret !== undefined &&
            fretIndex >= leftFret &&
            fretIndex <= rightFret
          );
        });

        // Shape-aware, spread-aware playable context.
        // True when this note coordinate should receive chord overlay emphasis.
        // Checks only the active shape(s) — not all polygons — so the spread
        // buffer correctly extends the active shape boundary, not any visible shape.
        const isInPlayableContext: boolean = (() => {
          if (!hasChordOverlay) return false;
          // 3NPS has no polygon shapes; gate chord overlay by aggregate fret bounds
          if (activePattern === "3nps" && shapeScope !== "global" && boxBounds.length > 0) {
            return boxBounds.some(
              (b) =>
                fretIndex >= b.minFret - chordFretSpread &&
                fretIndex <= b.maxFret + chordFretSpread,
            );
          }
          if (shapePolygons.length === 0 || !activePattern) return true;
          if (shapeScope === "global") return true;
          return shapePolygons.some((poly) => {
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

        // Both range and shape-membership now derive from the same computation.
        const isChordInRange = isInPlayableContext;
        const isInActiveShape = isInPlayableContext || !hasChordOverlay || !activePattern;

        // Use the composable semantic model when available; fall back to booleans.
        // Keys are sharp-normalized (per project convention) so no enharmonic lookup needed.
        const semantics = noteSemantics?.get(noteName);

        const noteClass = isNoteHidden
          ? "note-inactive"
          : semantics
            ? classifyNoteFromSemantics(
                semantics,
                isChordInRange,
                isInActiveShape,
                hasChordOverlay,
                isHighlighted,
                shapePolygons,
                boxBounds,
                fretIndex,
              )
            : classifyNote(
                isScaleRoot,
                isChordRootNote,
                isColorNote,
                isHighlighted,
                isChordTone,
                hasChordOverlay,
                isChordInRange,
                isInActiveShape,
                shapePolygons,
                boxBounds,
                fretIndex,
              );

        if (noteClass === "note-inactive") continue;

        let displayValue = getNoteDisplayInScale(
          noteName,
          rootNote,
          scale,
          useFlats,
        );
        if (displayFormat === "degrees" && rootNote) {
          const noteIdx = NOTES.indexOf(noteName);
          if (rootIdx !== -1 && noteIdx !== -1) {
            displayValue = INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
          }
        }

        const isWrapped = wrappedNotes.has(`${stringIndex}-${fretIndex}`);
        const applyDimOpacity =
          (shapePolygons.length > 0 &&
            !isInsideAnyPolygon &&
            (noteClass === "note-blue" ||
              noteClass === "chord-tone-outside-scale" ||
              noteClass === "chord-tone-in-scale" ||
              noteClass === "chord-root" ||
              noteClass === "key-tonic")) ||
          (isWrapped && isHighlighted);

        // Lens emphasis only applies when chord overlay is active.
        // Without an overlay, no lens-driven dimming or emphasis should alter scale notes.
        const lensEmphasis = getLensEmphasis(
          noteClass,
          hasChordOverlay ? practiceLens : undefined,
          semantics?.isGuideTone ?? false,
          semantics?.isTension ?? false,
        );

        const isHidden = false;

        notes.push({
          stringIndex,
          fretIndex,
          noteName,
          noteClass,
          displayValue,
          applyDimOpacity,
          applyLensEmphasis: lensEmphasis,
          isHidden,
          isTension: semantics?.isTension ?? false,
          isGuideTone: semantics?.isGuideTone ?? false,
        });
      }
    }
    return notes;
  }, [numStrings, fretboardLayout, totalColumns, startFret, maxFret, hiddenNotes, highlightNotes, hasChordOverlay, chordTones, rootNote, chordRoot, colorNotes, shapePolygons, boxBounds, chordFretSpread, scaleName, useFlats, displayFormat, wrappedNotes, practiceLens, noteSemantics, activePattern, activeShape, shapeScope]);
}