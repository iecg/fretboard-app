import React, { memo } from "react";
import { clsx } from "clsx";
import { formatAccidental } from "@fretflow/core";
import { getNoteVisuals } from "./utils/semantics";
import { CHORD_ROOT_HALO_RADIUS_PX, reduceCircleRadius, reduceSquircleRadius, squirclePath } from "./utils/noteSizing";
import styles from "./FretboardSVG.module.css";
import type { NoteAnimationMode } from "./motionPolicy";
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";

const CHORD_NOTE_CLASSES = new Set([
  "chord-root",
  "chord-tone",
  "chord-tone-in-scale",
  "chord-tone-outside-scale",
  "chord-outside",
  "note-diatonic-chord",
]);

interface FretboardNoteLayerProps {
  notes: RenderedFretboardNote[];
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
  filter?: "chord" | "non-chord";
  animationMode?: NoteAnimationMode;
}

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

export const FretboardNoteLayer = memo(({
  notes,
  noteBubblePx,
  displayFormat,
  degreeColorsEnabled,
  onNoteClick,
  filter,
  animationMode = "css",
}: FretboardNoteLayerProps) => {
  const filteredNotes = filter
    ? notes.filter(({ noteClass }) => {
        const isChord = CHORD_NOTE_CLASSES.has(noteClass);
        return filter === "chord" ? isChord : !isChord;
      })
    : notes;

  return (
    <g data-motion={animationMode}>
      {filteredNotes.map(({
        stringIndex,
        fretIndex,
        noteName,
        cx,
        cy,
        octave,
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
      }) => {
        const baseRadius = noteBubblePx / 2;
        const { radiusScale, noteShape } = getNoteVisuals(noteClass);
        const rawRadius = baseRadius * radiusScale * applyLensEmphasis.radiusBoost;
        const r = noteShape === "squircle"
          ? reduceSquircleRadius(rawRadius)
          : reduceCircleRadius(rawRadius);

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
                      : "color-mix(in srgb, var(--neon-orange) 22%, transparent)",
                    strokeWidth: isTension ? 1.8 : 1.5,
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
            <circle cx={cx} cy={cy} r={r} />
          );

        const baseOpacity = applyDimOpacity ? 0.8 : 1;
        const finalOpacity = baseOpacity * applyLensEmphasis.opacityBoost;
        const roleLabel = formatRole(noteClass);
        const ariaLabel = `${noteName}${octave} — ${roleLabel}`;
        const interactive = !!onNoteClick && !isHidden;
        return (
          <g
            key={`note-${stringIndex}-${fretIndex}`}
            className={clsx(
              styles["fretboard-note"],
              styles[noteClass],
              isHidden && "hidden",
            )}
            role="button"
            aria-label={ariaLabel}
            aria-hidden={isHidden || undefined}
            tabIndex={interactive ? 0 : -1}
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
            data-full-chord-shape={fullChordShape}
            data-lens-emphasis={applyLensEmphasis.glowColor ?? undefined}
            data-scale-degree={degreeColorsEnabled ? scaleDegree : undefined}
            data-degree-colors={degreeColorsEnabled ? "true" : undefined}
            style={{
              "--note-r": r,
              opacity: finalOpacity !== 1 ? finalOpacity : undefined,
              ...(degreeColor && degreeColorsEnabled
                ? { "--degree-color": degreeColor }
                : undefined),
            } as React.CSSProperties}
          >
            {shapeEl}
            {displayFormat !== "none" && (
              <text x={cx} y={cy}>
                {formatAccidental(displayValue)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});
FretboardNoteLayer.displayName = "FretboardNoteLayer";
