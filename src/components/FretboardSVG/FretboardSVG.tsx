import { useId, useMemo, useCallback, memo, type CSSProperties } from "react";
import {
  getNoteDisplay,
  type PracticeLens,
  type NoteSemantics,
} from "../../core/theory";
import { STRING_ROW_PX_TABLET } from "../../layout/responsive";
import styles from "./FretboardSVG.module.css";
import { useFretboardGeometry } from "./hooks/useFretboardGeometry";
import { useNoteData } from "./hooks/useNoteData";
import { type BoxBound } from "./utils/semantics";
import { FretboardBackground } from "./FretboardBackground";
import { FretboardDefs } from "./FretboardDefs";
import { FretboardShapeLayer } from "./FretboardShapeLayer";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
import { FretboardHitTargetLayer } from "./FretboardHitTargetLayer";
import { FretNumbersRow } from "./FretNumbersRow";
import type { ShapePolygon } from "../../shapes";
import type { ActiveShapeType } from "../../hooks/useFretboardState";
import {
  NECK_BORDER,
  INLAY_FRETS,
  INLAY_DOUBLE_FRETS,
  MAX_FRET,
  NOTE_BUBBLE_RATIO,
  NOTE_FONT_RATIO,
  INLAY_RADIUS_RATIO,
  INLAY_RADIUS_MIN,
} from "../../core/constants";

interface FretboardSVGProps {
  effectiveZoom: number;
  neckWidthPx: number;
  startFret: number;
  endFret: number;
  stringRowPx?: number;
  fretboardLayout: string[][];
  tuning: string[];
  maxFret?: number;
  highlightNotes: string[];
  rootNote: string;
  displayFormat?: "notes" | "degrees" | "none";
  boxBounds?: BoxBound[];
  chordTones?: string[];
  chordRoot?: string;
  chordFretSpread?: number;
  practiceLens?: PracticeLens;
  colorNotes?: string[];
  shapePolygons?: ShapePolygon[];
  wrappedNotes?: Set<string>;
  hiddenNotes?: Set<string>;
  useFlats?: boolean;
  scaleName?: string;
  /**
   * Active pattern context for shape-constrained chord overlay rendering.
   * When provided along with activeShape, the chord overlay will only highlight
   * chord tones that fall within the active shape/position boundaries.
   */
  activePattern?: "caged" | "3nps" | "all";
  /**
   * Active shape (CAGED letter or 3NPS position number) for shape-constrained
   * chord overlay rendering.
   */
  activeShape?: ActiveShapeType;
  /**
   * Shape scope context: distinguishes single-shape, multi-shape, and global rendering modes.
   * - "single": chord overlay constrained to one specific shape/position
   * - "multi": chord overlay spans multiple CAGED shapes or applies to current 3NPS position
   * - "global": chord overlay applies to all visible shapes (fingeringPattern="all")
   */
  shapeScope?: "single" | "multi" | "global";
  /**
   * Composable per-note semantics from noteSemanticMapAtom. When provided,
   * each rendered note element gains supplementary data attributes
   * (data-note-tension, data-note-guide-tone) so a note can carry multiple
   * semantic roles simultaneously — e.g. chord root AND tension note.
   */
  noteSemantics?: Map<string, NoteSemantics>;
  id?: string;
  onNoteClick?: (
    stringIndex: number,
    fretIndex: number,
    noteName: string,
  ) => void;
}

export const FretboardSVG = memo(function FretboardSVG({
  effectiveZoom,
  neckWidthPx,
  startFret,
  endFret,
  stringRowPx = STRING_ROW_PX_TABLET,
  fretboardLayout,
  tuning,
  maxFret = MAX_FRET,
  highlightNotes,
  rootNote,
  displayFormat = "notes",
  boxBounds = [],
  chordTones = [],
  chordRoot,
  chordFretSpread = 0,
  practiceLens,
  colorNotes = [],
  shapePolygons = [],
  wrappedNotes = new Set<string>(),
  hiddenNotes,
  useFlats = false,
  scaleName = "",
  activePattern,
  activeShape,
  shapeScope,
  noteSemantics,
  id,
  onNoteClick,
}: FretboardSVGProps) {
  // `effectiveZoom` stays on the prop surface (callers size the scroll area
  // around it) but non-uniform spacing inside this component is derived from
  // neckWidthPx + scale math, so the value isn't read here.
  void effectiveZoom;
  const internalId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const defsPrefix = `fretboard-${id ?? internalId}`;
  const svgDefId = useCallback((id: string) => `${defsPrefix}-${id}`, [defsPrefix]);
  const svgDefUrl = useCallback((id: string) => `url(#${svgDefId(id)})`, [svgDefId]);
  const glowFilterUrls = useMemo(() => ({
    cyan: svgDefUrl("glow-cyan"),
    orange: svgDefUrl("glow-orange"),
    violet: svgDefUrl("glow-violet"),
  }), [svgDefUrl]);

  const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
  const noteFontPx = Math.round(stringRowPx * NOTE_FONT_RATIO);
  const neckHeight = tuning.length * stringRowPx;
  const totalColumns = endFret - startFret;
  const hasChordOverlay = chordTones.length > 0;
  const numStrings = tuning.length;

  const {
    wireXRel,
    fretToX,
    fretCenterX,
    fretColumnWidth,
    taperYLeft,
    taperPath,
    cornerR,
    stringYAt,
  } = useFretboardGeometry({
    startFret,
    endFret,
    maxFret,
    neckWidthPx,
    neckHeight,
    noteBubblePx,
    numStrings,
  });

  const svgPolygons = useMemo(() => {
    return shapePolygons.map((poly, polyIdx) => {
      if (poly.vertices.length === 0) {
        return {
          points: "",
          color: poly.color,
          key: `${poly.shape}-${polyIdx}`,
          poly,
          centerX: 0,
        };
      }
      const pixelPoints: string[] = [];
      const verts = poly.vertices;
      const halfVerts = verts.length / 2;
      const clampedMin = Math.max(0, poly.intendedMin);
      const clampedMax = Math.min(maxFret, poly.intendedMax);

      const minLeftFret = Math.min(...verts.slice(0, halfVerts).map(v => v.fret));
      const maxRightFret = Math.max(...verts.slice(halfVerts).map(v => v.fret));
      const resolveLeftFret = (fret: number) =>
        minLeftFret < 0 && fret === clampedMin && poly.intendedMin < clampedMin
          ? poly.intendedMin
          : fret;
      const resolveRightFret = (fret: number) =>
        maxRightFret > maxFret && fret === clampedMax && poly.intendedMax > clampedMax
          ? poly.intendedMax
          : fret;

      pixelPoints.push(`${fretToX(resolveLeftFret(verts[0].fret))},0`);
      for (let i = 0; i < halfVerts; i++) {
        const fx = fretToX(resolveLeftFret(verts[i].fret));
        pixelPoints.push(`${fx},${stringYAt(verts[i].string, fx)}`);
      }
      pixelPoints.push(
        `${fretToX(resolveLeftFret(verts[halfVerts - 1].fret))},${neckHeight}`,
      );
      pixelPoints.push(
        `${fretToX(resolveRightFret(verts[halfVerts].fret))},${neckHeight}`,
      );
      for (let i = halfVerts; i < verts.length; i++) {
        const fx = fretToX(resolveRightFret(verts[i].fret));
        pixelPoints.push(`${fx},${stringYAt(verts[i].string, fx)}`);
      }
      pixelPoints.push(
        `${fretToX(resolveRightFret(verts[verts.length - 1].fret))},0`,
      );

      const points = pixelPoints.join(" ");
      const s5Center = (verts[halfVerts - 1].fret + verts[halfVerts].fret) / 2;
      const centerX = fretToX(Math.max(startFret, Math.min(endFret, s5Center)));
      return {
        points,
        color: poly.color,
        key: `${poly.shape}-${polyIdx}`,
        poly,
        centerX,
      };
    });
  }, [shapePolygons, startFret, endFret, maxFret, neckHeight, fretToX, stringYAt]);

  const displayRoot = rootNote
    ? getNoteDisplay(rootNote, rootNote, useFlats)
    : "";
  const ariaLabel = [
    "Guitar fretboard",
    displayRoot ? `— ${displayRoot}` : "",
    scaleName ? `${scaleName} scale` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Inlays follow local tapered geometry.
  const inlayYAt = useCallback(() => neckHeight / 2, [neckHeight]);
  const inlayYTopAt = useCallback((x: number) =>
    numStrings >= 4
      ? (stringYAt(1, x) + stringYAt(2, x)) / 2
      : stringYAt(0, x) + (stringYAt(numStrings - 1, x) - stringYAt(0, x)) / 3, [numStrings, stringYAt]);
  const inlayYBottomAt = useCallback((x: number) =>
    numStrings >= 4
      ? (stringYAt(numStrings - 3, x) + stringYAt(numStrings - 2, x)) / 2
      : stringYAt(0, x) +
        ((stringYAt(numStrings - 1, x) - stringYAt(0, x)) * 2) / 3, [numStrings, stringYAt]);

  const inlays = useMemo(() => {
    const inlayR = Math.max(INLAY_RADIUS_MIN, stringRowPx * INLAY_RADIUS_RATIO);
    return Array.from({ length: totalColumns + 1 }).map((_, idx) => {
      const fretIndex = startFret + idx;
      if (INLAY_FRETS.includes(fretIndex)) {
        const x = fretCenterX(fretIndex);
        return (
          <circle
            key={`inlay-${fretIndex}`}
            data-fret-marker={fretIndex}
            cx={x}
            cy={inlayYAt()}
            r={inlayR}
            fill={svgDefUrl("inlay-pearl")}
            filter={svgDefUrl("inlay-shadow")}
          />
        );
      }
      if (INLAY_DOUBLE_FRETS.includes(fretIndex)) {
        const x = fretCenterX(fretIndex);
        return (
          <g
            key={`inlay-${fretIndex}`}
            data-fret-marker={fretIndex}
            data-double-marker="true"
          >
            <circle
              cx={x}
              cy={inlayYTopAt(x)}
              r={inlayR}
              fill={svgDefUrl("inlay-pearl")}
              filter={svgDefUrl("inlay-shadow")}
            />
            <circle
              cx={x}
              cy={inlayYBottomAt(x)}
              r={inlayR}
              fill={svgDefUrl("inlay-pearl")}
              filter={svgDefUrl("inlay-shadow")}
            />
          </g>
        );
      }
      return null;
    });
  }, [totalColumns, startFret, stringRowPx, svgDefUrl, fretCenterX, inlayYAt, inlayYBottomAt, inlayYTopAt]);

  const noteData = useNoteData({
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
    scaleName: scaleName || "",
    useFlats,
    displayFormat,
    wrappedNotes,
    practiceLens,
    tuning,
    noteSemantics,
  });

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={styles["fretboard-board"]}
      data-practice-lens={hasChordOverlay ? practiceLens : undefined}
      data-testid="fretboard-svg"
    >
      <div
        className={styles["fretboard-neck"]}
        style={
          {
            height: `${neckHeight + NECK_BORDER * 2}px`,
            width: `${neckWidthPx + NECK_BORDER * 2}px`,
            willChange: "transform",
            "--string-row-px": `${stringRowPx}px`,
            "--fretboard-svg-glow-cyan-url": glowFilterUrls.cyan,
            "--fretboard-svg-glow-orange-url": glowFilterUrls.orange,
            "--fretboard-svg-glow-violet-url": glowFilterUrls.violet,
          } as CSSProperties
        }
      >
        {/* Visual SVG — aria-hidden; accessible buttons rendered separately below */}
        <svg
          className={styles["fretboard-main-svg"]}
          width={neckWidthPx}
          height={neckHeight}
          style={{
            display: "block",
            position: "absolute",
            top: NECK_BORDER,
            left: NECK_BORDER,
          }}
          aria-hidden="true"
        >
          <FretboardDefs
            svgDefId={svgDefId}
            neckWidthPx={neckWidthPx}
            neckHeight={neckHeight}
            taperPath={taperPath}
          />

          <FretboardBackground
            neckWidthPx={neckWidthPx}
            neckHeight={neckHeight}
            startFret={startFret}
            maxFret={maxFret}
            tuning={tuning}
            stringYAt={stringYAt}
            wireXRel={wireXRel}
            svgDefUrl={svgDefUrl}
            taperYLeft={taperYLeft}
            cornerR={cornerR}
            inlays={inlays}
          />

          <g clipPath={svgDefUrl("fretboard-taper")}>
            <FretboardShapeLayer svgPolygons={svgPolygons} />
            <FretboardNoteLayer
              noteData={noteData}
              fretCenterX={fretCenterX}
              stringYAt={stringYAt}
              noteBubblePx={noteBubblePx}
              displayFormat={displayFormat}
            />
          </g>
        </svg>

        <FretboardHitTargetLayer
          noteData={noteData}
          fretCenterX={fretCenterX}
          stringYAt={stringYAt}
          noteBubblePx={noteBubblePx}
          noteFontPx={noteFontPx}
          neckWidthPx={neckWidthPx}
          neckHeight={neckHeight}
          onNoteClick={onNoteClick}
        />
      </div>

      <FretNumbersRow
        totalColumns={totalColumns}
        startFret={startFret}
        maxFret={maxFret}
        neckWidthPx={neckWidthPx}
        fretColumnWidth={fretColumnWidth}
      />
    </div>
  );
});
