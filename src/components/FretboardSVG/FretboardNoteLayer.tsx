import { memo } from "react";
import { clsx } from "clsx";
import { formatAccidental } from "../../core/theory";
import { getNoteVisuals } from "./utils/semantics";
import styles from "./FretboardSVG.module.css";
import type { NoteData } from "./hooks/useNoteData";

interface FretboardNoteLayerProps {
  noteData: NoteData[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  noteBubblePx: number;
  displayFormat: "notes" | "degrees" | "none";
}

export const FretboardNoteLayer = memo(({
  noteData,
  fretCenterX,
  stringYAt,
  noteBubblePx,
  displayFormat,
}: FretboardNoteLayerProps) => {
  return (
    <>
      {noteData.map(({
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
                      ? "var(--neon-orange-dim)"
                      : "color-mix(in srgb, var(--neon-orange) 22%, transparent)",
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
      })}
    </>
  );
});
FretboardNoteLayer.displayName = "FretboardNoteLayer";
