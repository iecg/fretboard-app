import React, { memo } from "react";
import { clsx } from "clsx";
import { formatAccidental } from "@fretflow/core";
import { getNoteVisuals } from "./utils/semantics";
import { CHORD_ROOT_HALO_RADIUS_PX, reduceCircleRadius, reduceSquircleRadius, squirclePath } from "./utils/noteSizing";
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

interface FretboardNoteProps {
  note: RenderedFretboardNote;
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
}

// PURELY DECORATIVE. This SVG note layer lives inside an aria-hidden,
// pointer-events:none <svg> (see FretboardSVG.tsx). All interaction and
// accessible names are owned by FretboardHitTargetLayer's real <button>s, so
// this component intentionally carries NO role / aria-label / tabIndex / click
// or key handlers — a focusable element inside an aria-hidden subtree is invalid
// ARIA, and pointer/keyboard handlers here could never fire anyway.
export const FretboardNote = memo(function FretboardNote({
  note,
  noteBubblePx,
  displayFormat,
  degreeColorsEnabled,
}: FretboardNoteProps) {
  const {
    cx,
    cy,
    noteClass,
    displayValue,
    applyDimOpacity,
    applyLensEmphasis,
    isHidden,
    isTension,
    isGuideTone,
    scaleDegree,
    degreeColor,
    fullChordShape,
  } = note;

  const baseRadius = noteBubblePx / 2;
  const { radiusScale, noteShape } = getNoteVisuals(noteClass);
  const rawRadius = baseRadius * radiusScale;
  const r = noteShape === "squircle"
    ? reduceSquircleRadius(rawRadius)
    : reduceCircleRadius(rawRadius);

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
  return (
    <g
      className={clsx(
        styles["fretboard-note"],
        styles[noteClass],
        isHidden && "hidden",
      )}
      data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
      data-note-shape={noteShape}
      data-note-tension={isTension || undefined}
      data-note-guide-tone={isGuideTone || undefined}
      data-full-chord-mode={fullChordShape || undefined}
      data-lens-emphasis={applyLensEmphasis.glowColor ?? undefined}
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
      {applyLensEmphasis.glowColor && (
        <circle
          className={styles["note-glow-underlay"]}
          cx={cx}
          cy={cy}
          r={r}
          style={{ fill: applyLensEmphasis.glowColor }}
          aria-hidden="true"
        />
      )}
      {shapeEl}
      {displayFormat !== "none" && (
        <text x={cx} y={cy}>
          {formatAccidental(displayValue)}
        </text>
      )}
    </g>
  );
});
