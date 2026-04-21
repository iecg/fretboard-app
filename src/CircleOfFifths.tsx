import React, { memo } from "react";
import clsx from "clsx";
import {
  CIRCLE_OF_FIFTHS,
  getNoteDisplayInScale,
  getKeySignatureForDisplay,
  formatAccidental,
  SCALES,
} from "./theory";
import { getDegreesForScale } from "./degrees";
import { getCircleNoteLabels } from "./circleOfFifthsUtils";
import styles from "./CircleOfFifths.module.css";

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_RADIUS = SIZE * 0.48;
const INNER_RADIUS = SIZE * 0.26;
const LABEL_RADIUS = SIZE * 0.39;
const DEGREE_RADIUS = SIZE * 0.31;

function slicePath(index: number): string {
  const startAngle = ((index * 30 - 105) * Math.PI) / 180;
  const endAngle = (((index + 1) * 30 - 105) * Math.PI) / 180;
  const ox1 = CX + OUTER_RADIUS * Math.cos(startAngle);
  const oy1 = CY + OUTER_RADIUS * Math.sin(startAngle);
  const ox2 = CX + OUTER_RADIUS * Math.cos(endAngle);
  const oy2 = CY + OUTER_RADIUS * Math.sin(endAngle);
  const ix1 = CX + INNER_RADIUS * Math.cos(startAngle);
  const iy1 = CY + INNER_RADIUS * Math.sin(startAngle);
  const ix2 = CX + INNER_RADIUS * Math.cos(endAngle);
  const iy2 = CY + INNER_RADIUS * Math.sin(endAngle);
  return `M ${ix1} ${iy1} L ${ox1} ${oy1} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${ix1} ${iy1} Z`;
}

export const CircleOfFifths = memo(function CircleOfFifths({
  rootNote,
  setRootNote,
  scaleName = "Major",
  useFlats = false,
  enharmonicDisplay = "auto",
}: {
  rootNote: string;
  setRootNote: (n: string) => void;
  scaleName?: string;
  useFlats?: boolean;
  enharmonicDisplay?: "auto" | "on" | "off";
}) {
  const rootIndex = CIRCLE_OF_FIFTHS.indexOf(rootNote);
  const scaleIntervals = SCALES[scaleName] || [];

  const rootDisplayLabel = getNoteDisplayInScale(
    rootNote,
    rootNote,
    scaleIntervals,
    useFlats,
  );
  const keySig = getKeySignatureForDisplay(
    rootDisplayLabel,
    scaleName,
    useFlats,
  );
  const keySigText =
    keySig === 0 ? "♮" : keySig > 0 ? `${keySig}♯` : `${Math.abs(keySig)}♭`;
  const degreeMap = getDegreesForScale(scaleName);

  const [focusedIndex, setFocusedIndex] = React.useState<number>(0);
  const [keyboardFocused, setKeyboardFocused] = React.useState<boolean>(false);
  const segmentRefs = React.useRef<(SVGPathElement | null)[]>([]);

  React.useEffect(() => {
    segmentRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setKeyboardFocused(true);
      setFocusedIndex((index + 1) % 12);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setKeyboardFocused(true);
      setFocusedIndex((index + 11) % 12);
    } else if (e.key === "Home") {
      e.preventDefault();
      setKeyboardFocused(true);
      setFocusedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setKeyboardFocused(true);
      setFocusedIndex(11);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setRootNote(CIRCLE_OF_FIFTHS[index]);
    }
  };

  return (
    <div className={styles["circle-fifths-container"]} data-testid="circle-of-fifths">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles["circle-fifths-svg"]}
        role="group"
        aria-labelledby="cof-title"
        aria-describedby="cof-desc"
        data-testid="circle-of-fifths-svg"
      >
        <title id="cof-title">Circle of Fifths</title>
        <desc id="cof-desc">Interactive diagram to select the root note of the scale. Each segment represents a key, arranged in intervals of perfect fifths.</desc>
        <defs>
          <radialGradient id="circle-center-fill" cx="50%" cy="38%" r="74%">
            <stop offset="0%" stopColor="rgb(34 40 54 / 0.98)" />
            <stop offset="100%" stopColor="rgb(16 20 29 / 1)" />
          </radialGradient>
        </defs>
        {CIRCLE_OF_FIFTHS.map((note, index) => {
          const isActive = rootNote === note;
          const intervalIndex = (index - rootIndex + 12) % 12;
          const chromaticInterval = (intervalIndex * 7) % 12;
          const degreeStr = degreeMap[chromaticInterval] ?? "";

          const { primary } = getCircleNoteLabels(
            note,
            rootNote,
            useFlats,
            scaleIntervals,
            enharmonicDisplay,
          );

          return (
            <path
              key={note}
              ref={(el) => { segmentRefs.current[index] = el; }}
              d={slicePath(index)}
              className={clsx(styles["circle-slice"], {
                [styles.active]: isActive,
                [styles["circle-slice--scale"]]: degreeStr,
                [styles["circle-slice--muted"]]: !isActive && !degreeStr,
              })}
              stroke="var(--surface-highlight)"
              strokeWidth={1}
              style={{ outline: 'none' }}
              onClick={() => {
                setRootNote(note);
                setFocusedIndex(index);
                setKeyboardFocused(false);
              }}
              onPointerDown={() => {
                setKeyboardFocused(false);
              }}
              onFocus={(e) => {
                try {
                  if (e.currentTarget.matches(':focus-visible')) {
                    setKeyboardFocused(true);
                    setFocusedIndex(index);
                  }
                } catch {
                  setKeyboardFocused(true);
                  setFocusedIndex(index);
                }
              }}
              onBlur={() => {
                setKeyboardFocused(false);
              }}
              role="button"
              aria-label={`${primary} — ${isActive ? "selected" : "not selected"}`}
              aria-pressed={isActive}
              tabIndex={index === focusedIndex ? 0 : -1}
              onKeyDown={(e) => handleKeyDown(e, index)}
            />
          );
        })}

        {/* Focus ring overlay — keyboard-only, traces pie-slice shape (WCAG 2.4.7) */}
        {keyboardFocused && focusedIndex >= 0 && focusedIndex < CIRCLE_OF_FIFTHS.length && (
          <path
            key={`focus-ring-${CIRCLE_OF_FIFTHS[focusedIndex]}`}
            d={slicePath(focusedIndex)}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth={3}
            strokeLinejoin="round"
            pointerEvents="none"
            aria-hidden="true"
            className={styles["circle-slice-focus-ring"]}
          />
        )}

        {/* Text labels inside segments */}
        {CIRCLE_OF_FIFTHS.map((note, index) => {
          const angle = ((index * 30 - 90) * Math.PI) / 180;
          const lx = CX + LABEL_RADIUS * Math.cos(angle);
          const ly = CY + LABEL_RADIUS * Math.sin(angle);
          const dx = CX + DEGREE_RADIUS * Math.cos(angle);
          const dy = CY + DEGREE_RADIUS * Math.sin(angle);
          const isActive = rootNote === note;

          const intervalIndex = (index - rootIndex + 12) % 12;
          const chromaticInterval = (intervalIndex * 7) % 12;
          const degreeStr = degreeMap[chromaticInterval] ?? "";
          const noteTone = isActive
            ? "var(--neon-orange-bright)"
            : degreeStr
              ? "var(--neon-cyan-bright)"
              : "rgb(184 197 212 / 0.74)";
          const enharmonicTone = isActive
            ? "rgb(255 214 177 / 0.96)"
            : degreeStr
              ? "rgb(192 242 255 / 0.82)"
              : "rgb(171 183 197 / 0.74)";
          const degreeTone = isActive
            ? "var(--neon-orange)"
            : degreeStr
              ? "var(--neon-cyan)"
              : "rgb(165 176 188 / 0.56)";

          const { primary, enharmonic } = getCircleNoteLabels(
            note,
            rootNote,
            useFlats,
            scaleIntervals,
            enharmonicDisplay,
          );
          const noteFontSize = Math.max(
            16,
            isActive ? SIZE * 0.062 : SIZE * 0.054,
          );
          const degreeFontSize = Math.max(11, SIZE * 0.043);

          return (
            <g key={`text-group-${note}`} style={{ pointerEvents: "none" }}>
              {enharmonic !== null ? (
                <text
                  x={lx}
                  y={ly}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={noteFontSize}
                  fontWeight="bold"
                  fill={noteTone}
                  className={styles["circle-note-label"]}
                >
                  <tspan
                    x={lx}
                    dy="-0.3em"
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="2"
                    paintOrder="stroke"
                  >
                    {primary}
                  </tspan>
                  <tspan
                    x={lx}
                    dy="0.9em"
                    fontSize={Math.max(11, noteFontSize * 0.65)}
                    fontWeight="500"
                    fill={enharmonicTone}
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth="2.5"
                    paintOrder="stroke"
                  >
                    {enharmonic}
                  </tspan>
                </text>
              ) : (
                <text
                  x={lx}
                  y={ly}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={noteFontSize}
                  fontWeight="bold"
                  fill={noteTone}
                  className={styles["circle-note-label"]}
                >
                  <tspan
                    x={lx}
                    dy="0"
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="2"
                    paintOrder="stroke"
                  >
                    {primary}
                  </tspan>
                </text>
              )}

              {degreeStr && (
                <text
                  x={dx}
                  y={dy}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill={degreeTone}
                  fontSize={degreeFontSize}
                  fontWeight="bold"
                  opacity={isActive ? 1 : 0.92}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth="1.5"
                  paintOrder="stroke"
                  className={styles["circle-degree-label"]}
                >
                  {degreeStr}
                </text>
              )}
            </g>
          );
        })}

        {/* Inner donut hole */}
        <circle
          cx={CX}
          cy={CY}
          r={INNER_RADIUS}
          fill="url(#circle-center-fill)"
          stroke="rgb(255 255 255 / 0.08)"
          strokeWidth={1.4}
        />

        {/* Root note and key signature in center */}
        <text
          x={CX}
          y={CY - SIZE * 0.04}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--neon-orange-bright)"
          fontSize={Math.max(16, SIZE * 0.058)}
          fontWeight="bold"
          fontFamily="var(--font-display)"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="2"
          paintOrder="stroke"
          className={styles["circle-center-note"]}
        >
          {formatAccidental(rootDisplayLabel)}
        </text>
        <text
          x={CX}
          y={CY + SIZE * 0.04}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--neon-cyan-bright)"
          fontSize={Math.max(16, SIZE * 0.064)}
          fontWeight="bold"
          fontFamily="var(--font-display)"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="2"
          paintOrder="stroke"
          className={styles["circle-center-signature"]}
        >
          {keySigText}
        </text>
      </svg>
    </div>
  );
});
