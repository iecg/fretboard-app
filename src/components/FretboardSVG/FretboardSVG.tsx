import { useId, useMemo, useCallback, memo, type CSSProperties } from "react";
import { clsx } from "clsx";
import {
  getNoteDisplay,
  formatAccidental,
  type PracticeLens,
  type NoteSemantics,
} from "../../core/theory";
import { STRING_ROW_PX_TABLET } from "../../layout/responsive";
import styles from "./FretboardSVG.module.css";
import { useFretboardGeometry } from "./hooks/useFretboardGeometry";
import { useNoteData } from "./hooks/useNoteData";
import { getNoteVisuals, type BoxBound } from "./utils/semantics";
import { FretboardBackground } from "./FretboardBackground";
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
          <defs>
            <linearGradient id={svgDefId("fretboard-wood")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--fretboard-wood-top)" />
              <stop offset="55%" stopColor="#0d0805" />
              <stop offset="100%" stopColor="var(--fretboard-wood-bottom)" />
            </linearGradient>
            <linearGradient
              id={svgDefId("fretboard-vignette")}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="rgb(0 0 0 / 0.55)" />
              <stop offset="8%" stopColor="rgb(0 0 0 / 0.16)" />
              <stop offset="50%" stopColor="rgb(255 255 255 / 0)" />
              <stop offset="92%" stopColor="rgb(0 0 0 / 0.16)" />
              <stop offset="100%" stopColor="rgb(0 0 0 / 0.55)" />
            </linearGradient>
            <filter
              id={svgDefId("wood-grain-filter")}
              x="0%"
              y="0%"
              width="100%"
              height="100%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.95"
                numOctaves="4"
                seed="3"
                result="grain"
              />
              <feColorMatrix
                in="grain"
                type="matrix"
                values="0 0 0 0 0.09
                        0 0 0 0 0.05
                        0 0 0 0 0.03
                        0 0 0 0.72 0"
                result="grainTinted"
              />
              <feComposite in="grainTinted" in2="SourceGraphic" operator="in" />
            </filter>
            <filter
              id={svgDefId("wood-highlights-filter")}
              x="0%"
              y="0%"
              width="100%"
              height="100%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.022 0.55"
                numOctaves="2"
                seed="11"
                result="hl"
              />
              <feColorMatrix
                in="hl"
                type="matrix"
                values="0 0 0 0 0.32
                        0 0 0 0 0.21
                        0 0 0 0 0.12
                        0 0 0 0.09 0"
              />
            </filter>
            <filter
              id={svgDefId("wood-pores-filter")}
              x="0%"
              y="0%"
              width="100%"
              height="100%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.55 0.55"
                numOctaves="1"
                seed="23"
                result="pores"
              />
              <feColorMatrix
                in="pores"
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0.16 0"
              />
            </filter>
            {/* userSpaceOnUse ensures filter region isn't sized to zero-height line bbox */}
            <filter
              id={svgDefId("string-shadow-blur")}
              filterUnits="userSpaceOnUse"
              x={-4}
              y={-4}
              width={neckWidthPx + 8}
              height={neckHeight + 8}
            >
              <feGaussianBlur stdDeviation="0.75" />
            </filter>
            <linearGradient id={svgDefId("nut-material")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#f4f4f1" />
              <stop offset="75%" stopColor="#d8d4cb" />
              <stop offset="100%" stopColor="#a9a59b" />
            </linearGradient>
            <linearGradient
              id={svgDefId("fret-wire-cylinder")}
              x1="0" y1="0" x2="1" y2="0"
            >
              <stop offset="0%" stopColor="#3e444c" />
              <stop offset="25%" stopColor="#a6afbc" />
              <stop offset="50%" stopColor="#ebeff5" />
              <stop offset="75%" stopColor="#a6afbc" />
              <stop offset="100%" stopColor="#3e444c" />
            </linearGradient>
            <radialGradient id={svgDefId("inlay-pearl")} cx="35%" cy="32%" r="75%">
              <stop
                offset="0%"
                stopColor="rgb(250 247 232)"
                stopOpacity="0.98"
              />
              <stop
                offset="55%"
                stopColor="rgb(218 209 182)"
                stopOpacity="0.88"
              />
              <stop
                offset="100%"
                stopColor="rgb(156 144 118)"
                stopOpacity="0.75"
              />
            </radialGradient>
            <filter
              id={svgDefId("inlay-shadow")}
              x="-60%"
              y="-60%"
              width="220%"
              height="220%"
            >
              <feDropShadow
                dx="0"
                dy="0.6"
                stdDeviation="0.9"
                floodColor="#000"
                floodOpacity="0.6"
              />
            </filter>
            <filter
              id={svgDefId("glow-cyan")}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3"
                floodColor="#4DE4FF"
                floodOpacity="0.65"
              />
            </filter>
            <filter
              id={svgDefId("glow-orange")}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3"
                floodColor="#FF9A4D"
                floodOpacity="0.65"
              />
            </filter>
            <filter
              id={svgDefId("glow-violet")}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3"
                floodColor="#A78BFA"
                floodOpacity="0.65"
              />
            </filter>
            <clipPath id={svgDefId("fretboard-taper")}>
              <path d={taperPath} />
            </clipPath>
          </defs>

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
            inlays={inlays}
          />

          <g clipPath={svgDefUrl("fretboard-taper")}>
            {/* Shape polygons overlay */}
            {svgPolygons.length > 0 &&
              svgPolygons.map(({ points, color, key }) => (
                <polygon key={key} points={points} fill={color} stroke="none" style={{ pointerEvents: "none" }} />
              ))}

            {/* Note circles (outlined-glow) — visual only, aria-hidden SVG */}
            {noteData.map(
              ({
                stringIndex,
                fretIndex,
                noteClass,
                displayValue,
                applyDimOpacity,
                applyLensEmphasis,
                isHidden,
                isTension,
                isGuideTone,
              }) => {
                const cx = fretCenterX(fretIndex);
                const cy = stringYAt(stringIndex, cx);
                const baseRadius = noteBubblePx / 2;
                const { radiusScale, noteShape } = getNoteVisuals(noteClass);
                const r = baseRadius * radiusScale * applyLensEmphasis.radiusBoost;

                const shapeEl =
                  noteShape === "squircle" ? (
                    <>
                      {noteClass === "chord-root" && (
                        /* Outer halo: inline style prevents CSS class rules from overriding
                           fill/stroke so the halo remains a transparent ring (not a filled rect).
                           When isTension, the halo echoes the dashed tension signal. */
                        <rect
                          x={cx - r - 3.5}
                          y={cy - r - 3.5}
                          width={(r + 3.5) * 2}
                          height={(r + 3.5) * 2}
                          rx={(r + 3.5) * 0.38}
                          ry={(r + 3.5) * 0.38}
                          style={{
                            fill: "none",
                            stroke: isTension
                              ? "rgb(255 154 77 / 0.45)"
                              : "rgb(255 154 77 / 0.22)",
                            strokeWidth: isTension ? 1.8 : 1.5,
                            strokeDasharray: isTension ? "6 3" : undefined,
                            paintOrder: "stroke",
                          }}
                        />
                      )}
                      <rect
                        x={cx - r}
                        y={cy - r}
                        width={r * 2}
                        height={r * 2}
                        rx={r * 0.38}
                        ry={r * 0.38}
                      />
                    </>
                  ) : noteShape === "diamond" ? (
                    <polygon
                      points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
                    />
                  ) : noteShape === "hexagon" ? (
                    <polygon
                      points={Array.from({ length: 6 }, (_, i) => {
                        const a = (Math.PI / 3) * i - Math.PI / 6;
                        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
                      }).join(" ")}
                    />
                  ) : (
                    <circle cx={cx} cy={cy} r={r} />
                  );
                // Apply lens emphasis
                const baseOpacity = applyDimOpacity ? 0.8 : 1;
                const finalOpacity = baseOpacity * applyLensEmphasis.opacityBoost;
                return (
                  <g
                    key={`note-${stringIndex}-${fretIndex}`}
                    className={clsx(
                      styles["fretboard-note"],
                      styles[noteClass],
                      isHidden && "hidden",
                    )}
                    data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
                    data-note-shape={noteShape}
                    data-note-tension={isTension || undefined}
                    data-note-guide-tone={isGuideTone || undefined}
                    data-lens-emphasis={applyLensEmphasis.glowColor ?? undefined}
                    style={{
                      opacity: finalOpacity,
                    }}
                  >
                    {shapeEl}
                    {displayFormat !== "none" && (
                      <text x={cx} y={cy}>
                        {formatAccidental(displayValue)}
                      </text>
                    )}
                  </g>
                );
              },
            )}
          </g>
        </svg>

        {/* Accessible button layer — transparent, positioned over SVG circles */}
        <div
          className={styles["fretboard-a11y-layer"]}
          style={{
            position: "absolute",
            top: NECK_BORDER,
            left: NECK_BORDER,
            width: neckWidthPx,
            height: neckHeight,
          }}
        >
          {noteData.map(
            ({ stringIndex, fretIndex, noteClass, displayValue, isHidden, noteName, isTension, isGuideTone }) => {
              const cx = fretCenterX(fretIndex);
              const cy = stringYAt(stringIndex, cx);
              const r = noteBubblePx / 2;
              return (
                <button
                  key={`btn-${stringIndex}-${fretIndex}`}
                  type="button"
                  onClick={
                    onNoteClick && !isHidden
                      ? () => onNoteClick(stringIndex, fretIndex, noteName)
                      : undefined
                  }
                  disabled={!onNoteClick || isHidden}
                  aria-hidden={isHidden || undefined}
                  tabIndex={isHidden ? -1 : undefined}
                  aria-label={`${formatAccidental(displayValue)} on string ${stringIndex + 1}, fret ${fretIndex}`}
                  data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
                  data-note-tension={isTension || undefined}
                  data-note-guide-tone={isGuideTone || undefined}
                  className={clsx(
                    styles["note-bubble"],
                    styles[noteClass],
                    isHidden && "hidden",
                  )}
                  style={{
                    position: "absolute",
                    left: cx - r,
                    top: cy - r,
                    width: noteBubblePx,
                    height: noteBubblePx,
                    fontSize: `${noteFontPx}px`,
                    opacity: 0,
                    pointerEvents:
                      onNoteClick && !isHidden ? "auto" : "none",
                  }}
                />
              );
            },
          )}
        </div>
      </div>

      {/* Fret numbers row — rendered AFTER the board in DOM order. Each span
          matches the visual width of its fret column so the numbers stay
          centred beneath each box (columns are non-uniform). */}
      <div
        className={styles["fret-numbers-row"]}
        aria-hidden="true"
        style={{
          width: `${neckWidthPx + NECK_BORDER * 2}px`,
          paddingLeft: `${NECK_BORDER}px`,
        }}
      >
        {Array.from({ length: totalColumns + 1 }).map((_, idx) => {
          const fretIndex = startFret + idx;
          return (
            <span
              key={`fn-${fretIndex}`}
              className={styles["fret-number"]}
              style={{ width: `${fretColumnWidth(fretIndex)}px` }}
            >
              {fretIndex > 0 && fretIndex < maxFret ? fretIndex : ""}
            </span>
          );
        })}
      </div>

    </div>
  );
});
