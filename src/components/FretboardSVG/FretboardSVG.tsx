import { useId, useMemo, useCallback, memo, type CSSProperties } from "react";
import { useAtomValue } from "jotai";
import { motion, AnimatePresence } from "motion/react";
import {
  getNoteDisplay,
  getScaleSemitones,
  type PracticeLens,
  type NoteSemantics,
} from "@fretflow/core";
import {
  scaleDegreeColorsEnabledAtom,
  fingeringPatternAtom,
  effectiveShapeDataAtom,
} from "../../store/atoms";
import { STRING_ROW_PX_TABLET } from "../../layout/responsive";
import styles from "./FretboardSVG.module.css";
import { useFretboardGeometry } from "./hooks/useFretboardGeometry";
import { useNoteData } from "./hooks/useNoteData";
import { useChordConnectorPolylines } from "./hooks/useChordConnectorPolylines";
import { useIntervalConnectorPolylines } from "./hooks/useIntervalConnectorPolylines";
import { type BoxBound } from "./utils/semantics";
import { FretboardBackground } from "./FretboardBackground";
import { FretboardDefs } from "./FretboardDefs";
import { FretboardShapeLayer } from "./FretboardShapeLayer";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
import { FretboardHitTargetLayer } from "./FretboardHitTargetLayer";
import { FretNumbersRow } from "./FretNumbersRow";
import type { ShapePolygon } from "@fretflow/core";
import type { ActiveShapeType } from "../../hooks/useFretboardState";
import {
  INLAY_FRETS,
  INLAY_DOUBLE_FRETS,
  MAX_FRET,
  NOTE_BUBBLE_RATIO,
  NOTE_FONT_RATIO,
  INLAY_RADIUS_RATIO,
  INLAY_RADIUS_MIN,
} from "@fretflow/core";

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
  activePattern?: "caged" | "3nps" | "none";
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
  const degreeColorsEnabled = useAtomValue(scaleDegreeColorsEnabledAtom);
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const { intervalPairs } = useAtomValue(effectiveShapeDataAtom);
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
  // Playable neck height — strings, frets, inlays, and shape polygons all
  // live within this box, matching the original (pre-connector-fix)
  // proportions of a guitar fretboard.
  const neckHeight = tuning.length * stringRowPx;
  // Vertical padding outside the SVG that gives chord-connector capsules
  // room to overshoot the outermost strings without revealing the
  // app-container gradient. Sized to cover the maximum capsule radius
  // (`stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR + maxOffsetPx`
  // where CHORD_CONNECTOR_BASE_RADIUS_FACTOR = 0.47, max offset = 10 px,
  // plus a 2 px breathing buffer). Painted by a wood-toned `<rect>` that
  // overflows the SVG box, clipped by an extended `fretboard-svg-box`,
  // and surrounded by extra height on `.fretboard-neck`. Kept in sync
  // manually with `useChordConnectorPolylines.ts` rather than imported to
  // avoid coupling render geometry to overlay-detection internals.
  const verticalInsetPx = Math.ceil(stringRowPx * 0.47) + 12;
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

      // Vertex frets are used as-is. A vertex stays off-board only when its
      // template offset truly puts it there (i.e., the scale would have a
      // note at the imaginary fret). Vertices that legitimately sit at fret 0
      // or maxFret are not pulled to intendedMin/intendedMax — that flattened
      // mixed-offset templates and produced spurious off-board extension.

      pixelPoints.push(`${fretToX(verts[0].fret)},0`);
      for (let i = 0; i < halfVerts; i++) {
        const fx = fretToX(verts[i].fret);
        pixelPoints.push(`${fx},${stringYAt(verts[i].string, fx)}`);
      }
      pixelPoints.push(
        `${fretToX(verts[halfVerts - 1].fret)},${neckHeight}`,
      );
      pixelPoints.push(
        `${fretToX(verts[halfVerts].fret)},${neckHeight}`,
      );
      for (let i = halfVerts; i < verts.length; i++) {
        const fx = fretToX(verts[i].fret);
        pixelPoints.push(`${fx},${stringYAt(verts[i].string, fx)}`);
      }
      pixelPoints.push(
        `${fretToX(verts[verts.length - 1].fret)},0`,
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
  }, [shapePolygons, startFret, endFret, neckHeight, fretToX, stringYAt]);

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
    degreeColorsEnabled,
    wrappedNotes,
    practiceLens,
    tuning,
    noteSemantics,
  });

  // Scale semitone offsets (0-11) drive per-pair color via scale-degree position
  // on the interval connector polylines.
  const scaleSemitones = useMemo(() => {
    if (!scaleName || !rootNote) return [];
    return getScaleSemitones(rootNote, scaleName);
  }, [scaleName, rootNote]);

  const intervalConnectorPolylines = useIntervalConnectorPolylines({
    intervalPairs,
    tuning,
    scaleSemitones,
    fretCenterX,
    stringYAt,
    stringRowPx,
  });

  // Per-string chord filter (UAT-3): when fingering pattern restricts to 1 or 2 strings,
  // highlightNotes already contains only those string coords, so chord-tone role naturally
  // applies only to in-pattern notes. Chord connectors are suppressed separately here
  // because cross-string voicings do not make sense in a 1/2-string context.
  const connectorPolylines = useChordConnectorPolylines({
    noteData,
    chordToneNames:
      fingeringPattern === "one-string" || fingeringPattern === "two-strings"
        ? []
        : chordTones,
    fretCenterX,
    stringYAt,
    stringRowPx,
    chordRoot: chordRoot ?? "",
  });

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={styles["fretboard-board"]}
      data-practice-lens={hasChordOverlay ? practiceLens : undefined}
      data-degree-colors={degreeColorsEnabled ? "true" : undefined}
      data-testid="fretboard-svg"
    >
      <div
        className={styles["fretboard-neck"]}
        style={
          {
            // The neck box reserves `verticalInsetPx` of wood-toned padding
            // above the top string and below the bottom string so chord/
            // interval connector capsules can overshoot the outermost
            // strings without revealing the .app-container gradient. The
            // SVG itself stays sized to the playable `neckHeight`; an
            // extended base-wood `<rect>` overflows the SVG via
            // `overflow: visible` to fill the padding zones.
            height: `${neckHeight + 2 * verticalInsetPx}px`,
            width: `${neckWidthPx}px`,
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
            top: verticalInsetPx,
            left: 0,
          }}
          aria-hidden="true"
        >
          <FretboardDefs
            svgDefId={svgDefId}
            neckWidthPx={neckWidthPx}
            neckHeight={neckHeight}
            verticalInsetPx={verticalInsetPx}
            taperPath={taperPath}
          />

          <FretboardBackground
            neckWidthPx={neckWidthPx}
            neckHeight={neckHeight}
            verticalInsetPx={verticalInsetPx}
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
          </g>

          {/* Chord + interval connectors render OUTSIDE the wood `fretboard-taper`
              clip so geometry that crosses the wood's tapered top/bottom + nut/body
              edges near the outer strings stays visible. They ARE clipped to the
              SVG's bounding box (`fretboard-svg-box`). A base wood-gradient rect
              behind the tapered wood stack (see FretboardBackground) fills the same
              SVG box, so connector pixels that overflow into the taper-carved
              corner gaps land on a wood-toned backdrop instead of revealing the
              app-container gradient. Rendered BEFORE the note layer so note
              bubbles paint on top (later SVG siblings paint above earlier ones). */}
          <g
            className={styles["fretboard-overlays"]}
            clipPath={svgDefUrl("fretboard-svg-box")}
            aria-hidden="true"
            pointerEvents="none"
          >
            <AnimatePresence>
              {connectorPolylines.length > 0 && (
                <motion.g
                  key="chord-connectors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className={styles["chord-connectors"]}
                  aria-hidden="true"
                  pointerEvents="none"
                >
                  {/* Fill pass: all voicings rendered first (below outlines) */}
                  {connectorPolylines.map((voicing) => (
                    <motion.path
                      key={`fill-${voicing.voicingKey}`}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      d={voicing.paths.fill}
                      data-layer="fill"
                      data-palette-index={voicing.paletteIndex + 1}
                      style={{ originX: "50%", originY: "50%" }}
                    />
                  ))}
                  {/* Outline pass: all voicings rendered on top */}
                  {connectorPolylines.map((voicing) => (
                    <motion.path
                      key={`outline-${voicing.voicingKey}`}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      d={voicing.paths.outline}
                      data-layer="outline"
                      data-palette-index={voicing.paletteIndex + 1}
                      style={{ originX: "50%", originY: "50%" }}
                    />
                  ))}
                </motion.g>
              )}
            </AnimatePresence>
            {/* Interval connectors — capsule/blob shape matching chord-connector visual style.
                Per-pair color driven by lower-note scale-degree via --chord-connector-color-N.
                Two render passes (fill + outline) mirror chord-connector convention. */}
            {intervalConnectorPolylines.length > 0 && (
              <g
                className={styles["interval-connectors"]}
                aria-hidden="true"
                pointerEvents="none"
              >
                {/* Fill pass */}
                {intervalConnectorPolylines.map((line) => (
                  <path
                    key={`iv-fill-${line.key}`}
                    d={line.paths.fill}
                    data-layer="fill"
                    data-palette-index={line.paletteIndex}
                  />
                ))}
                {/* Outline pass */}
                {intervalConnectorPolylines.map((line) => (
                  <path
                    key={`iv-outline-${line.key}`}
                    d={line.paths.outline}
                    data-layer="outline"
                    data-palette-index={line.paletteIndex}
                  />
                ))}
              </g>
            )}
          </g>

          {/* Note bubbles render LAST so they paint on top of the connectors. */}
          <g clipPath={svgDefUrl("fretboard-taper")}>
            <FretboardNoteLayer
              noteData={noteData}
              fretCenterX={fretCenterX}
              stringYAt={stringYAt}
              noteBubblePx={noteBubblePx}
              displayFormat={displayFormat}
              degreeColorsEnabled={degreeColorsEnabled}
              onNoteClick={onNoteClick}
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
          verticalInsetPx={verticalInsetPx}
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
