import { useMemo } from "react";
import {
  NOTES,
  ENHARMONICS,
  getNoteDisplayInScale,
  INTERVAL_NAMES,
  SCALES,
  type PracticeLens,
  type NoteSemantics,
} from "@fretflow/core";
import { DEGREE_COLORS, getDegreesForScale } from "@fretflow/core";
import { getFretNoteWithOctave, parseNote } from "@fretflow/core";
import type { ShapePolygon, CagedShape } from "@fretflow/core";
import type { ActiveShapeType } from "../../../hooks/useFretboardState";
import {
  getLensEmphasis,
  classifyNote,
  classifyNoteFromSemantics,
  type BoxBound,
  type LensEmphasis,
  type LeadLensContext,
} from "../utils/semantics";

export interface NoteData {
  stringIndex: number;
  fretIndex: number;
  noteName: string;
  octave: number;
  noteClass: string;
  displayValue: string;
  applyDimOpacity: boolean;
  applyLensEmphasis: LensEmphasis;
  isHidden: boolean;
  isTension: boolean;
  isGuideTone: boolean;
  scaleDegree?: string;
  degreeColor?: string;
  fullChordShape?: CagedShape;
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
  chordFretSpread: number;
  activePattern?: "caged" | "3nps" | "none";
  shapeScope?: "single" | "multi" | "global";
  activeShape?: ActiveShapeType;
  scaleName: string;
  preferFlats: boolean;
  displayFormat?: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
  wrappedNotes: Set<string>;
  practiceLens?: PracticeLens;
  tuning: string[];
  noteSemantics?: Map<string, NoteSemantics>;
  fullChordPositionKeys?: Set<string>;
  fullChordShapeByPosition?: Map<string, CagedShape>;
  chordBoxBounds: BoxBound[] | null;
  /**
   * Lead lens context data read from atoms once per render (Task 4.5).
   * Only populated when practiceLens === "lead". Passed per-note into
   * getLensEmphasis to drive hold/departing/anticipation emphasis.
   * Optional — when absent, lead lens falls back to tones-base behavior.
   */
  leadLensData?: {
    commonWithNext: Set<string>;
    nextGuideTones: Set<string>;
    beatPosition: number;
    stepDurationBeats: number;
  };
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
  chordFretSpread,
  activePattern,
  shapeScope,
  activeShape,
  scaleName,
  preferFlats,
  displayFormat,
  degreeColorsEnabled,
  wrappedNotes,
  practiceLens,
  tuning,
  noteSemantics,
  fullChordPositionKeys,
  fullChordShapeByPosition,
  chordBoxBounds,
  leadLensData,
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
    const hasFullChordPositionFilter = !!fullChordPositionKeys && fullChordPositionKeys.size > 0;

    // Pre-calculate color notes set
    const colorNoteSet = new Set(colorNotes);

    const degreesMap = getDegreesForScale(scaleName);

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

        const isNoteHidden = normalizedHidden.has(noteName) || normalizedHidden.has(positionKey);

        const isHighlighted =
          !isNoteHidden &&
          (highlightSet.has(noteName) ||
            highlightSet.has(positionKey));
        
        const isChordTone =
          !isNoteHidden &&
          hasChordOverlay &&
          chordToneSet.has(noteName) &&
          isMatchedFullChordPosition;
        
        const isScaleRoot =
          !isNoteHidden &&
          (noteName === rootNote ||
            ENHARMONICS[noteName] === rootNote ||
            ENHARMONICS[rootNote] === noteName);
        
        const isChordRootNote =
          !isNoteHidden &&
          !!chordRoot &&
          isMatchedFullChordPosition &&
          (noteName === chordRoot ||
            ENHARMONICS[noteName] === chordRoot ||
            ENHARMONICS[chordRoot] === noteName);
        
        const isColorNote = !!(!isNoteHidden && colorNoteSet.size > 0 && (
          colorNoteSet.has(noteName) || 
          (ENHARMONICS[noteName] && colorNoteSet.has(ENHARMONICS[noteName]!))
        ));

        const isInsideAnyPolygon = shapePolygons.some((poly) => {
          if (poly.truncated) return false;
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

          // When the user has not opted into position scoping (or no active position
          // exists), the chord overlay is unbounded — every chord tone receives the
          // chord-overlay treatment regardless of fingering pattern.
          if (chordBoxBounds === null) return true;

          // Below this point, chordBoxBounds is non-null — the user opted in and a single
          // position is active. The existing position-aware clamp follows.
          if (hasFullChordPositionFilter && fullChordPositionKeys.has(positionKey)) {
            return true;
          }
          // 3NPS has no polygon shapes; gate chord overlay by aggregate fret bounds
          // AND by per-coordinate shape membership.
          if (activePattern === "3nps" && shapeScope !== "global" && chordBoxBounds.length > 0) {
            const inFretRange = chordBoxBounds.some(
              (b) =>
                fretIndex >= b.minFret - chordFretSpread &&
                fretIndex <= b.maxFret + chordFretSpread,
            );
            if (!inFretRange) return false;
            // Require the specific (stringIndex, fretIndex) to be a member of the
            // active 3NPS position. The aggregate fret range spans all strings, so a
            // chord tone that happens to fall in-band on a string but at a fret not
            // part of the position would otherwise get a chord-tone class. Including
            // those out-of-position notes in activeTones causes the connector algorithm
            // to prefer a tighter-span voicing using them over the expected in-position
            // voicing (e.g., C@str4-fret15 and G@str5-fret15 beating C@str3-fret10 /
            // G@str4-fret10 / E@str5-fret12 on the bottom three strings).
            // When scale is hidden, highlightNotes is cleared to [] — fall back to
            // fret-range-only so the chord overlay remains visible.
            if (highlightNotes.length > 0) {
              return highlightSet.has(`${stringIndex}-${fretIndex}`);
            }
            return true;
          }
          if (shapePolygons.length === 0 || !activePattern) return true;
          if (shapeScope === "global") return true;
          return shapePolygons.some((poly) => {
            if (poly.truncated) return false;
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

        const noteClass = isNoteHidden
          ? "note-inactive"
          : effectiveSemantics
            ? classifyNoteFromSemantics(
                effectiveSemantics,
                isChordInRange,
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
                isChordInRange,
                isInActiveShape,
              );

        // Skip explicitly hidden notes, but keep "note-inactive" (those not in the 
        // current scale/chord) as hit targets so they remain playable.
        if (isNoteHidden) continue;

        let displayValue = getNoteDisplayInScale(
          noteName,
          rootNote,
          scale,
          preferFlats,
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
              noteClass === "note-diatonic-chord" ||
              noteClass === "chord-root" ||
              noteClass === "key-tonic")) ||
          (isWrapped && isHighlighted);

        // Lens emphasis only applies when chord overlay is active.
        // Without an overlay, no lens-driven dimming or emphasis should alter scale notes.
        //
        // Lead lens (Task 4.5): build per-note LeadLensContext from the pre-read
        // leadLensData (atoms read once per hook call in FretboardSVG.tsx, never
        // inside this loop). When leadLensData is absent, getLensEmphasis falls
        // back to tones-base behavior automatically.
        const activeLens = hasChordOverlay ? practiceLens : undefined;
        let leadContext: LeadLensContext | undefined;
        if (activeLens === "lead" && leadLensData) {
          leadContext = {
            notePc: noteName,
            commonWithNext: leadLensData.commonWithNext,
            nextGuideTones: leadLensData.nextGuideTones,
            beatPosition: leadLensData.beatPosition,
            stepDurationBeats: leadLensData.stepDurationBeats,
          };
        }
        const lensEmphasis = getLensEmphasis(
          noteClass,
          activeLens,
          effectiveSemantics?.isGuideTone ?? false,
          leadContext,
        );

        // Visual hiddenness: inactive notes are not rendered in the note layer.
        const isHidden = noteClass === "note-inactive";

        // Calculate scale degree color when degree colors are enabled
        let scaleDegree: string | undefined;
        let degreeColor: string | undefined;
        if (degreeColorsEnabled && rootIdx !== -1) {
          const noteIdx = NOTES.indexOf(noteName);
          if (noteIdx !== -1) {
            const chromaticInterval = (noteIdx - rootIdx + 12) % 12;
            scaleDegree = scale.includes(chromaticInterval)
              ? degreesMap[chromaticInterval] ?? INTERVAL_NAMES[chromaticInterval]
              : undefined;
            if (scaleDegree) {
              degreeColor = DEGREE_COLORS[scaleDegree];
            }
          }
        }

        const openString = tuning[stringIndex];
        const noteWithOctave = openString
          ? getFretNoteWithOctave(openString, fretIndex)
          : `${noteName}4`;
        const octave = parseNote(noteWithOctave)?.octave ?? 4;

        const objectToBePushed = {
          stringIndex,
          fretIndex,
          noteName,
          octave,
          noteClass,
          displayValue,
          applyDimOpacity,
          applyLensEmphasis: lensEmphasis,
          isHidden,
          isTension: effectiveSemantics?.isTension ?? false,
          isGuideTone: effectiveSemantics?.isGuideTone ?? false,
          scaleDegree,
          degreeColor,
          fullChordShape,
        };
        notes.push(objectToBePushed);
      }
    }
    return notes;
  }, [numStrings, fretboardLayout, totalColumns, startFret, maxFret, hiddenNotes, highlightNotes, hasChordOverlay, chordTones, rootNote, chordRoot, colorNotes, shapePolygons, chordFretSpread, scaleName, preferFlats, displayFormat, degreeColorsEnabled, wrappedNotes, practiceLens, tuning, noteSemantics, activePattern, activeShape, shapeScope, fullChordPositionKeys, fullChordShapeByPosition, chordBoxBounds, leadLensData]);
}
