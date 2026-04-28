import { memo, type ReactNode } from "react";
import { clsx } from "clsx";
import { NUT_WIDTH } from "../../core/constants";
import { useWoodGrainTexture } from "./hooks/useWoodGrainTexture";
import styles from "./FretboardSVG.module.css";

interface FretboardBackgroundProps {
  neckWidthPx: number;
  neckHeight: number;
  startFret: number;
  maxFret: number;
  tuning: string[];
  stringYAt: (s: number, x: number) => number;
  wireXRel: (wireIndex: number) => number;
  svgDefUrl: (id: string) => string;
  taperYLeft: number;
  cornerR: number;
  inlays: ReactNode[];
}

export const FretboardBackground = memo(
  ({
    neckWidthPx,
    neckHeight,
    startFret,
    maxFret,
    tuning,
    stringYAt,
    wireXRel,
    svgDefUrl,
    taperYLeft,
    cornerR,
    inlays,
  }: FretboardBackgroundProps) => {
    const woodGrainDataUrl = useWoodGrainTexture(neckWidthPx, neckHeight);

    const woodStack = (
      <>
        <rect
          x={0}
          y={0}
          width={neckWidthPx}
          height={neckHeight}
          fill={svgDefUrl("fretboard-wood")}
        />
        {woodGrainDataUrl ? (
          <image
            href={woodGrainDataUrl}
            x={0}
            y={0}
            width={neckWidthPx}
            height={neckHeight}
            preserveAspectRatio="none"
          />
        ) : (
          <>
            <rect
              x={0}
              y={0}
              width={neckWidthPx}
              height={neckHeight}
              fill="#000"
              filter={svgDefUrl("wood-grain-filter")}
              opacity={0.92}
            />
            <rect
              x={0}
              y={0}
              width={neckWidthPx}
              height={neckHeight}
              fill="#000"
              filter={svgDefUrl("wood-highlights-filter")}
              opacity={0.6}
            />
            <rect
              x={0}
              y={0}
              width={neckWidthPx}
              height={neckHeight}
              fill="#000"
              filter={svgDefUrl("wood-pores-filter")}
              opacity={0.5}
            />
          </>
        )}
        <rect
          x={0}
          y={0}
          width={neckWidthPx}
          height={neckHeight}
          fill={svgDefUrl("fretboard-vignette")}
        />
      </>
    );

    const fretWires = [];
    const wireThickness = 4;
    const wireStart = startFret === 0 ? 1 : startFret - 1;
    for (let wireIdx = wireStart; wireIdx < maxFret; wireIdx++) {
      const x = wireXRel(wireIdx);
      fretWires.push(
        <g key={`fw-${wireIdx}`}>
          <rect
            x={x + 0.6}
            y={0}
            width={wireThickness}
            height={neckHeight}
            fill="rgb(0 0 0 / 0.45)"
          />
          <rect
            x={x - wireThickness / 2}
            y={0}
            width={wireThickness}
            height={neckHeight}
            fill={svgDefUrl("fret-wire-cylinder")}
          />
        </g>,
      );
    }

    const strings = tuning.map((_openString, stringIndex) => {
      const yLeft = stringYAt(stringIndex, 0);
      const yRight = stringYAt(stringIndex, neckWidthPx);
      const isBass = stringIndex >= 3;
      return (
        <g key={`string-${stringIndex}`}>
          <line
            x1={0}
            y1={yLeft + 1.8}
            x2={neckWidthPx}
            y2={yRight + 1.8}
            stroke="rgb(0 0 0 / 0.7)"
            style={{
              strokeWidth: `calc(var(--string-taper-${stringIndex + 1}) + 1.4px)`,
            }}
            strokeLinecap="round"
            filter={svgDefUrl("string-shadow-blur")}
          />
          <line
            x1={0}
            y1={yLeft}
            x2={neckWidthPx}
            y2={yRight}
            stroke={
              isBass
                ? "var(--string-wire-bass, #c6ccd2)"
                : "var(--string-wire, #e4e8ee)"
            }
            style={{ strokeWidth: `var(--string-taper-${stringIndex + 1})` }}
            strokeLinecap="round"
            className={clsx(
              styles["fretboard-string"],
              `fretboard-string-${stringIndex + 1}`,
            )}
          />
          {isBass && (
            <line
              x1={0}
              y1={yLeft}
              x2={neckWidthPx}
              y2={yRight}
              stroke="rgb(60 65 72 / 0.55)"
              style={{ strokeWidth: `var(--string-taper-${stringIndex + 1})` }}
              strokeLinecap="butt"
              strokeDasharray="0.6 1.4"
            />
          )}
        </g>
      );
    });

    const nutRightX = startFret === 0 ? wireXRel(0) : 0;
    const nutLeftX = nutRightX - NUT_WIDTH;

    return (
      <>
        <g clipPath={svgDefUrl("fretboard-taper")}>
          {woodStack}
          {startFret === 0 && (
            <rect
              x={0}
              y={0}
              width={Math.max(0, nutRightX - NUT_WIDTH)}
              height={neckHeight}
              fill="var(--fretboard-headstock-bg)"
            />
          )}
          {startFret === 0 && (
            <g>
              <rect
                x={nutLeftX}
                y={0}
                width={NUT_WIDTH}
                height={neckHeight}
                fill={svgDefUrl("nut-material")}
              />
              <line
                x1={nutLeftX}
                y1={0.5}
                x2={nutRightX}
                y2={0.5}
                stroke="rgb(255 252 240 / 0.85)"
                strokeWidth={1}
              />
              <line
                x1={nutLeftX}
                y1={neckHeight - 0.5}
                x2={nutRightX}
                y2={neckHeight - 0.5}
                stroke="rgb(0 0 0 / 0.5)"
                strokeWidth={1}
              />
              <line
                x1={nutRightX - 0.5}
                y1={0}
                x2={nutRightX - 0.5}
                y2={neckHeight}
                stroke="rgb(0 0 0 / 0.55)"
                strokeWidth={0.6}
              />
              {tuning.map((_, i) => (
                <rect
                  key={`nut-slot-${i}`}
                  x={nutRightX - 2}
                  y={stringYAt(i, nutRightX) - 0.9}
                  width={2.4}
                  height={1.8}
                  rx={0.9}
                  fill="var(--fretboard-nut-slot-color)"
                />
              ))}
            </g>
          )}
          {fretWires}
          {inlays}
          {strings}
        </g>
        <path
          d={
            cornerR > 0
              ? `M 0 ${taperYLeft} L ${neckWidthPx - cornerR} 0 Q ${neckWidthPx} 0 ${neckWidthPx} ${cornerR}`
              : `M 0 ${taperYLeft} L ${neckWidthPx} 0`
          }
          stroke="var(--fretboard-top-edge-color)"
          strokeWidth={0.9}
          fill="none"
        />
        <path
          d={
            cornerR > 0
              ? `M 0 ${neckHeight - taperYLeft} L ${neckWidthPx - cornerR} ${neckHeight} Q ${neckWidthPx} ${neckHeight} ${neckWidthPx} ${neckHeight - cornerR}`
              : `M 0 ${neckHeight - taperYLeft} L ${neckWidthPx} ${neckHeight}`
          }
          stroke="var(--fretboard-bottom-edge-color)"
          strokeWidth={1}
          fill="none"
        />
      </>
    );
  },
);
FretboardBackground.displayName = "FretboardBackground";
