import React, { memo } from "react";
import clsx from "clsx";
import {
  CIRCLE_OF_FIFTHS,
  getNoteDisplayInScale,
  getKeySignatureForDisplay,
  formatAccidental,
  SCALES,
} from "../../core/theory";
import { getDegreesForScale } from "../../core/degrees";
import { getScaleCatalogEntry } from "../../core/theoryCatalog";
import { getCircleNoteLabels } from "../../core/circleOfFifthsUtils";
import styles from "./CircleOfFifths.module.css";

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_RADIUS = SIZE * 0.48;
const INNER_RADIUS = SIZE * 0.16;
const LABEL_RADIUS = SIZE * 0.38;
const DEGREE_RADIUS = SIZE * 0.26;

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
  variant = "card",
}: {
  rootNote: string;
  setRootNote: (n: string) => void;
  scaleName?: string;
  useFlats?: boolean;
  enharmonicDisplay?: "auto" | "on" | "off";
  variant?: "card" | "inline";
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

  const scaleEntry = getScaleCatalogEntry(scaleName);
  const parentMajorOffset = scaleEntry?.member.parentMajorOffset ?? 0;
  
  const SEMITONES_TO_CIRCLE_STEPS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

  let relLabel = "Relative Minor";
  let relScaleName = "Natural Minor";
  let relIndex = (rootIndex + 3) % 12;
  let relSuffix = "m";
  
  if (scaleName === "Natural Minor" || scaleName === "Minor") {
    relLabel = "Relative Major";
    relScaleName = "Major";
    relIndex = (rootIndex + 9) % 12;
    relSuffix = "";
  } else if (scaleName !== "Major") {
    relLabel = "Parent Scale";
    relScaleName = "Major";
    const circleSteps = SEMITONES_TO_CIRCLE_STEPS[parentMajorOffset] ?? 0;
    relIndex = (rootIndex + circleSteps) % 12;
    relSuffix = "";
  }

  const relNote = CIRCLE_OF_FIFTHS[relIndex];
  const relDisplay = getNoteDisplayInScale(
    relNote,
    relNote,
    SCALES[relScaleName] || [],
    useFlats,
  );

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
    <div className={styles["circle-fifths-container"]} data-testid="circle-of-fifths" data-variant={variant}>
      <div className={styles["circle-svg-wrapper"]}>
        <svg
          viewBox={`-10 -10 ${SIZE + 20} ${SIZE + 20}`}
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
              <stop offset="0%" stopColor="var(--cof-center-start)" />
              <stop offset="100%" stopColor="var(--cof-center-end)" />
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

          {/* Focus ring for keyboard nav (WCAG 2.4.7) */}
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
              ? "var(--cof-note-active)"
              : degreeStr
                ? "var(--cof-note-scale)"
                : "var(--cof-note-muted)";
            const enharmonicTone = isActive
              ? "var(--cof-enharmonic-active)"
              : degreeStr
                ? "var(--cof-enharmonic-scale)"
                : "var(--cof-enharmonic-muted)";
            const degreeTone = isActive
              ? "var(--cof-degree-active)"
              : degreeStr
                ? "var(--cof-degree-scale)"
                : "var(--cof-degree-muted)";

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
            const degreeFontSize = Math.max(10, SIZE * 0.038);

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
                      stroke="var(--cof-text-stroke)"
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
                      stroke="var(--cof-text-stroke)"
                      strokeWidth="2"
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
                      stroke="var(--cof-text-stroke)"
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
                    stroke="var(--cof-text-stroke)"
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
            stroke="var(--cof-inner-stroke)"
            strokeWidth={1.4}
          />
          
          <text
            x={CX}
            y={CY}
            dominantBaseline="middle"
            textAnchor="middle"
            fill="var(--cof-note-active)"
            fontSize={SIZE * 0.07}
            fontWeight="bold"
            style={{ pointerEvents: "none" }}
          >
            {formatAccidental(rootDisplayLabel)}
          </text>
        </svg>
      </div>

      <div className={styles["circle-footer"]}>
        <div className={styles["circle-footer-item"]}>
          <span className={styles["circle-footer-label"]}>Key Signature</span>
          <span className={styles["circle-footer-value"]}>{keySigText}</span>
        </div>
        <div className={styles["circle-footer-item"]}>
          <span className={styles["circle-footer-label"]}>{relLabel}</span>
          <span className={styles["circle-footer-value"]}>
            {formatAccidental(relDisplay)}{relSuffix}
          </span>
        </div>
      </div>
    </div>
  );
});
