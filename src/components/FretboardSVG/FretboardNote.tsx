import React, { memo } from "react";
import { clsx } from "clsx";
import { formatAccidental } from "@fretflow/core";
import { getNoteVisuals } from "./utils/semantics";
import { CHORD_ROOT_HALO_RADIUS_PX, glowUnderlayRadiusPx, reduceCircleRadius, reduceSquircleRadius, squirclePath } from "./utils/noteSizing";
import styles from "./FretboardSVG.module.css";
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";

const CAGED_SHAPE_CSS_VAR: Record<string, string> = {
  E: "var(--caged-e)",
  D: "var(--caged-d)",
  C: "var(--caged-c)",
  A: "var(--caged-a)",
  G: "var(--caged-g)",
};

const CAGED_SHAPE_TEXT_VAR: Record<string, string> = {
  E: "var(--caged-e-fg)",
  D: "var(--caged-d-fg)",
  C: "var(--caged-c-fg)",
  A: "var(--caged-a-fg)",
  G: "var(--caged-g-fg)",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "root-active": "scale root",
  "chord-root": "chord root",
  "chord-tone": "chord tone",
  "chord-tone-in-scale": "chord tone in scale",
  "chord-tone-outside-scale": "chord tone outside scale",
  "note-diatonic-chord": "diatonic chord tone",
  "note-blue": "blue note",
  "note-active": "scale note",
  "note-scale-only": "scale note",
  "chord-outside": "chord tone outside scale",
  "color-tone": "color tone",
  "key-tonic": "key tonic",
  "note-inactive": "inactive",
};

const formatRole = (noteClass: string): string =>
  ROLE_DESCRIPTIONS[noteClass] ?? noteClass.replace(/-/g, " ");

interface FretboardNoteProps {
  note: RenderedFretboardNote;
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
}

export const FretboardNote = memo(function FretboardNote({
  note,
  noteBubblePx,
  displayFormat,
  degreeColorsEnabled,
  onNoteClick,
}: FretboardNoteProps) {
  const {
    stringIndex,
    fretIndex,
    noteName,
    cx,
    cy,
    octave,
    noteClass,
    displayName,
    displayValue,
    applyDimOpacity,
    applyLensEmphasis,
    isHidden,
    isTension,
    isGuideTone,
    scaleDegree,
    degreeColor,
    fullChordShape,
    transitionRole,
  } = note;

  const baseRadius = noteBubblePx / 2;
  const { radiusScale, noteShape } = getNoteVisuals(noteClass);
  const rawRadius = baseRadius * radiusScale;
  const r = noteShape === "squircle"
    ? reduceSquircleRadius(rawRadius)
    : reduceCircleRadius(rawRadius);
  // The glow underlay is enlarged for squircles so the soft halo reads around
  // the shape instead of being hidden under its filled corners.
  const glowR = glowUnderlayRadiusPx(r, noteShape === "squircle");

  const fullChordStyle = fullChordShape
    ? {
        "--shape-fill": CAGED_SHAPE_CSS_VAR[fullChordShape],
        "--shape-stroke":
          noteClass === "chord-root"
            ? "var(--note-ring-tonic)"
            : CAGED_SHAPE_CSS_VAR[fullChordShape],
        "--shape-stroke-width":
          noteClass === "chord-root" ? "3.2" : undefined,
        "--text-fill":
          noteClass === "chord-root"
            ? "#ffffff"
            : CAGED_SHAPE_TEXT_VAR[fullChordShape],
      }
    : undefined;

  const shapeEl =
    noteShape === "squircle" ? (
      <>
        {noteClass === "chord-root" && (
          <path
            d={squirclePath(cx, cy, r + CHORD_ROOT_HALO_RADIUS_PX)}
            style={{
              fill: "none",
              stroke: isTension
                ? "var(--neon-orange-dim)"
                : "var(--note-ring-tonic)",
              strokeWidth: 1.8,
              strokeDasharray: isTension ? "6 3" : undefined,
              paintOrder: "stroke",
            }}
          />
        )}
        <path d={squirclePath(cx, cy, r)} />
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
      <>
        {noteClass === "key-tonic" && (
          <circle
            cx={cx}
            cy={cy}
            r={r + CHORD_ROOT_HALO_RADIUS_PX}
            style={{ fill: "none", stroke: "var(--note-ring-tonic)", strokeWidth: 1.8, paintOrder: "stroke" }}
          />
        )}
        <circle cx={cx} cy={cy} r={r} />
      </>
    );

  const baseOpacity = applyDimOpacity ? 0.8 : 1;
  const finalOpacity = baseOpacity * applyLensEmphasis.opacityBoost;
  const roleLabel = formatRole(noteClass);
  // Announce the same flat/sharp spelling sighted users see (e.g. "B♭", not the
  // internal sharp "A#"). displayName carries the scale-aware spelling. #493
  const ariaLabel = `${formatAccidental(displayName)}${octave} — ${roleLabel}`;
  const interactive = !!onNoteClick && !isHidden;
  return (
    <g
      className={clsx(
        styles["fretboard-note"],
        styles[noteClass],
        isHidden && "hidden",
      )}
      role={interactive ? "button" : undefined}
      aria-label={ariaLabel}
      aria-hidden={isHidden || undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? () => onNoteClick!(stringIndex, fretIndex, noteName)
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNoteClick!(stringIndex, fretIndex, noteName);
              }
            }
          : undefined
      }
      data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
      data-note-shape={noteShape}
      data-note-tension={isTension || undefined}
      data-note-guide-tone={isGuideTone || undefined}
      data-full-chord-mode={fullChordShape || undefined}
      data-transition-role={transitionRole ?? undefined}
      data-in-region={note.isInRegion ? "true" : undefined}
      data-scale-degree={degreeColorsEnabled ? scaleDegree : undefined}
      data-degree-colors={degreeColorsEnabled ? "true" : undefined}
      style={{
        "--note-r": r,
        "--emph-scale": applyLensEmphasis.radiusBoost,
        transformBox: "fill-box",
        transformOrigin: "center",
        transform: "scale(var(--emph-scale, 1))",
        opacity: finalOpacity !== 1 ? finalOpacity : undefined,
        ...(degreeColor && degreeColorsEnabled
          ? { "--degree-color": degreeColor }
          : undefined),
        ...(fullChordStyle as React.CSSProperties),
      } as React.CSSProperties}
    >
      <circle
        className={styles["note-glow-underlay"]}
        cx={cx}
        cy={cy}
        r={glowR}
        style={applyLensEmphasis.glowColor ? { fill: applyLensEmphasis.glowColor } : undefined}
        data-glow={applyLensEmphasis.glowColor ? "on" : "off"}
        aria-hidden="true"
      />
      {shapeEl}
      {displayFormat !== "none" && (
        <text x={cx} y={cy}>
          {formatAccidental(displayValue)}
        </text>
      )}
    </g>
  );
});
