import { clsx } from "clsx";
import { NOTES, ENHARMONICS, getNoteDisplay, getNoteDisplayInScale, INTERVAL_NAMES, formatAccidental, SCALES } from "./theory";
import { parseNote } from "./guitar";
import "./FretboardSVG.css";
import type { ShapePolygon } from "./shapes";

const STRING_ROW_PX_DEFAULT = 40;
const NECK_BORDER = 4;
const NUT_WIDTH = 8;
const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const INLAY_DOUBLE_FRETS = [12, 24];

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
  boxBounds?: { minFret: number; maxFret: number }[];
  chordTones?: string[];
  chordFretSpread?: number;
  hideNonChordNotes?: boolean;
  colorNotes?: string[];
  shapePolygons?: ShapePolygon[];
  shapeLabels?: "caged" | "none";
  wrappedNotes?: Set<string>;
  useFlats?: boolean;
  scaleName?: string;
  onNoteClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
}

type BoxBound = { minFret: number; maxFret: number };

function classifyNote(
  isRoot: boolean, isColorNote: boolean, isHighlighted: boolean,
  isChordTone: boolean, hasChordOverlay: boolean, isChordInRange: boolean,
  shapePolygons: ShapePolygon[], boxBounds: BoxBound[], fretIndex: number
): string {
  if (isRoot && (isHighlighted || (isChordTone && isChordInRange))) return "root-active";
  if (isColorNote && isHighlighted) return "note-blue";
  if (isHighlighted && isChordTone) return "chord-tone";
  if (isHighlighted && !hasChordOverlay) return "note-active";
  if (isHighlighted && hasChordOverlay) return "note-scale-only";
  if (!isHighlighted && isChordTone && isChordInRange) return "chord-outside";
  if (isColorNote && shapePolygons.length > 0 &&
      boxBounds.some(b => fretIndex >= b.minFret - 1 && fretIndex <= b.maxFret + 1))
    return "note-blue";
  return "note-inactive";
}

function getNoteVisuals(noteClass: string): {
  stroke: string;
  filter: string;
  fill: string;
  textFill: string;
  radiusScale: number;
  strokeWidth: number;
  coreFill: string;
  coreOpacity: number;
  textOpacity: number;
} {
  switch (noteClass) {
    case "root-active":
      return {
        stroke: "var(--note-ring-tonic)",
        filter: "url(#glow-orange)",
        fill: "rgb(255 154 77 / 0.28)",
        textFill: "var(--note-text-tonic)",
        radiusScale: 1.08,
        strokeWidth: 2.8,
        coreFill: "rgb(255 176 92 / 0.26)",
        coreOpacity: 1,
        textOpacity: 1,
      };
    case "chord-tone":
      return {
        stroke: "var(--note-ring-tonic)",
        filter: "url(#glow-orange)",
        fill: "rgb(255 154 77 / 0.16)",
        textFill: "var(--note-text-tonic)",
        radiusScale: 0.98,
        strokeWidth: 2.4,
        coreFill: "rgb(255 176 92 / 0.14)",
        coreOpacity: 1,
        textOpacity: 1,
      };
    case "note-active":
    case "note-blue":
      return {
        stroke: "var(--note-ring)",
        filter: "url(#glow-cyan)",
        fill: "rgb(77 228 255 / 0.06)",
        textFill: "var(--note-text-in-scale)",
        radiusScale: 0.92,
        strokeWidth: 2.1,
        coreFill: "rgb(77 228 255 / 0.12)",
        coreOpacity: 1,
        textOpacity: 1,
      };
    case "note-scale-only":
      return {
        stroke: "var(--note-ring-dim)",
        filter: "url(#glow-cyan)",
        fill: "rgb(77 228 255 / 0.03)",
        textFill: "var(--note-text-in-scale)",
        radiusScale: 0.84,
        strokeWidth: 1.85,
        coreFill: "rgb(77 228 255 / 0.08)",
        coreOpacity: 0.55,
        textOpacity: 0.82,
      };
    case "chord-outside":
      return {
        stroke: "var(--note-ring)",
        filter: "url(#glow-cyan)",
        fill: "rgb(77 228 255 / 0.02)",
        textFill: "var(--note-text-in-scale)",
        radiusScale: 0.76,
        strokeWidth: 1.5,
        coreFill: "rgb(77 228 255 / 0.06)",
        coreOpacity: 0.35,
        textOpacity: 0.72,
      };
    default:
      return {
        stroke: "none",
        filter: "none",
        fill: "transparent",
        textFill: "transparent",
        radiusScale: 0.8,
        strokeWidth: 0,
        coreFill: "transparent",
        coreOpacity: 0,
        textOpacity: 0,
      };
  }
}

export function FretboardSVG({
  effectiveZoom,
  neckWidthPx,
  startFret,
  endFret,
  stringRowPx = STRING_ROW_PX_DEFAULT,
  fretboardLayout,
  tuning,
  maxFret = 24,
  highlightNotes,
  rootNote,
  displayFormat = "notes",
  boxBounds = [],
  chordTones = [],
  chordFretSpread = 0,
  hideNonChordNotes = false,
  colorNotes = [],
  shapePolygons = [],
  shapeLabels = "none",
  wrappedNotes = new Set<string>(),
  useFlats = false,
  scaleName = "",
  onNoteClick,
}: FretboardSVGProps) {
  const noteBubblePx = Math.round(stringRowPx * 0.8);
  const noteFontPx = Math.round(stringRowPx * 0.4);
  const neckHeight = tuning.length * stringRowPx;
  const totalColumns = endFret - startFret + 1;
  const hasChordOverlay = chordTones.length > 0;
  const numStrings = tuning.length;

  const fretToX = (fret: number) => (fret - startFret + 0.5) * effectiveZoom;
  const stringCenterY = (s: number) => stringRowPx / 2 + s * stringRowPx;

  const fretCenterX = (fret: number) => fretToX(fret);

  const svgPolygons = shapePolygons.map((poly, polyIdx) => {
    if (poly.vertices.length === 0) {
      return { points: "", color: poly.color, key: `${poly.shape}-${polyIdx}`, poly, centerX: 0 };
    }
    const pixelPoints: string[] = [];
    const verts = poly.vertices;
    const halfVerts = verts.length / 2;
    const clampedMin = Math.max(0, poly.intendedMin);
    const clampedMax = Math.min(maxFret, poly.intendedMax);
    const resolveLeftFret = (fret: number) =>
      fret === clampedMin && poly.intendedMin < clampedMin ? poly.intendedMin : fret;
    const resolveRightFret = (fret: number) =>
      fret === clampedMax && poly.intendedMax > clampedMax ? poly.intendedMax : fret;

    pixelPoints.push(`${fretToX(resolveLeftFret(verts[0].fret))},0`);
    for (let i = 0; i < halfVerts; i++) {
      pixelPoints.push(`${fretToX(resolveLeftFret(verts[i].fret))},${stringCenterY(verts[i].string)}`);
    }
    pixelPoints.push(`${fretToX(resolveLeftFret(verts[halfVerts - 1].fret))},${neckHeight}`);
    pixelPoints.push(`${fretToX(resolveRightFret(verts[halfVerts].fret))},${neckHeight}`);
    for (let i = halfVerts; i < verts.length; i++) {
      pixelPoints.push(`${fretToX(resolveRightFret(verts[i].fret))},${stringCenterY(verts[i].string)}`);
    }
    pixelPoints.push(`${fretToX(resolveRightFret(verts[verts.length - 1].fret))},0`);

    const points = pixelPoints.join(" ");
    const s5Center = (verts[halfVerts - 1].fret + verts[halfVerts].fret) / 2;
    const centerX = fretToX(Math.max(startFret, Math.min(endFret, s5Center)));
    return { points, color: poly.color, key: `${poly.shape}-${polyIdx}`, poly, centerX };
  });

  const displayRoot = rootNote ? getNoteDisplay(rootNote, rootNote, useFlats) : "";
  const ariaLabel = [
    "Guitar fretboard",
    displayRoot ? `— ${displayRoot}` : "",
    scaleName ? `${scaleName} scale` : "",
  ].filter(Boolean).join(" ");

  const inlayY = neckHeight / 2;
  const inlayYTop = numStrings >= 4 ? stringCenterY(1) : neckHeight / 3;
  const inlayYBottom = numStrings >= 4 ? stringCenterY(numStrings - 2) : (neckHeight * 2) / 3;
  const inlayR = Math.max(4, stringRowPx * 0.12);

  // Pre-compute note data for both SVG rendering and accessible button layer
  const noteData = tuning.flatMap((_openString, stringIndex) =>
    Array.from({ length: totalColumns }, (_, idx) => {
      const fretIndex = startFret + idx;
      const noteName = fretboardLayout[stringIndex][fretIndex];

      const isHighlighted = highlightNotes.includes(noteName) ||
        highlightNotes.includes(`${stringIndex}-${fretIndex}`);
      const isChordTone = hasChordOverlay && chordTones.includes(noteName);
      const isRoot = noteName === rootNote ||
        ENHARMONICS[noteName] === rootNote || ENHARMONICS[rootNote] === noteName;
      const isColorNote = colorNotes.length > 0 && colorNotes.some(cn =>
        noteName === cn || ENHARMONICS[noteName] === cn || ENHARMONICS[cn] === noteName
      );
      const isChordInRange = !hasChordOverlay || !shapePolygons.length ||
        boxBounds.some(b =>
          fretIndex >= b.minFret - chordFretSpread && fretIndex <= b.maxFret + chordFretSpread
        );

      const noteClass = classifyNote(
        isRoot, isColorNote, isHighlighted, isChordTone,
        hasChordOverlay, isChordInRange, shapePolygons, boxBounds, fretIndex
      );

      let displayValue = getNoteDisplayInScale(noteName, rootNote, SCALES[scaleName] || [], useFlats);
      if (displayFormat === "degrees" && rootNote) {
        const normRoot = ENHARMONICS[rootNote]?.includes("b") ? ENHARMONICS[rootNote] : rootNote;
        const rootIdx = NOTES.indexOf(normRoot.includes("#") ? normRoot : rootNote);
        const noteIdx = NOTES.indexOf(noteName);
        if (rootIdx !== -1 && noteIdx !== -1) {
          displayValue = INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
        }
      } else if (fretIndex === 0 && parseNote(_openString)?.noteName === noteName) {
        displayValue = getNoteDisplayInScale(noteName, rootNote, SCALES[scaleName] || [], useFlats);
      }

      const isWrapped = wrappedNotes.has(`${stringIndex}-${fretIndex}`);
      const isInsideAnyPolygon = shapePolygons.some(poly => {
        const leftFret = poly.vertices[stringIndex]?.fret;
        const rightFret = poly.vertices[poly.vertices.length - 1 - stringIndex]?.fret;
        return leftFret !== undefined && rightFret !== undefined &&
          fretIndex >= leftFret && fretIndex <= rightFret;
      });
      const applyDimOpacity = (shapePolygons.length > 0 && !isInsideAnyPolygon &&
        (noteClass === "note-blue" || noteClass === "chord-outside" ||
         noteClass === "chord-tone" || noteClass === "root-active")) ||
        (isWrapped && isHighlighted);

      const isHidden = noteClass === "note-scale-only" && hideNonChordNotes;

      return { stringIndex, fretIndex, noteName, noteClass, displayValue, applyDimOpacity, isHidden };
    })
  );

  return (
    <div role="group" aria-label={ariaLabel} className="fretboard-board">
      <div
        className="fretboard-neck"
        style={{
          height: `${neckHeight + NECK_BORDER * 2}px`,
          width: `${neckWidthPx + NECK_BORDER * 2}px`,
          "--string-row-px": `${stringRowPx}px`,
        } as React.CSSProperties}
      >
        {/* Visual SVG — aria-hidden; accessible buttons rendered separately below */}
        <svg
          className="fretboard-main-svg"
          width={neckWidthPx}
          height={neckHeight}
          style={{ display: "block", position: "absolute", top: NECK_BORDER, left: NECK_BORDER }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="fretboard-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--fretboard-wood-top)" />
              <stop offset="100%" stopColor="var(--fretboard-wood-bottom)" />
            </linearGradient>
            <linearGradient id="fretboard-vignette" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgb(8 6 6 / 0.45)" />
              <stop offset="7%" stopColor="rgb(8 6 6 / 0.12)" />
              <stop offset="50%" stopColor="rgb(255 255 255 / 0)" />
              <stop offset="93%" stopColor="rgb(8 6 6 / 0.12)" />
              <stop offset="100%" stopColor="rgb(8 6 6 / 0.45)" />
            </linearGradient>
            <pattern id="wood-grain" width="160" height="48" patternUnits="userSpaceOnUse">
              <path d="M-10 12c18-8 34-7 54-2 20 5 40 6 61-2 17-6 34-7 55 0" fill="none" stroke="rgb(255 255 255 / 0.04)" strokeWidth="1.2" />
              <path d="M-16 26c24-10 43-8 65-3 23 5 42 4 62-4 16-7 33-7 54-1" fill="none" stroke="rgb(0 0 0 / 0.14)" strokeWidth="1.4" />
              <path d="M-10 40c20-7 38-6 59-1 21 5 40 4 62-4 18-6 33-6 53 1" fill="none" stroke="rgb(255 255 255 / 0.035)" strokeWidth="1" />
            </pattern>
            <linearGradient id="string-plain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(255 255 255 / 0.92)" />
              <stop offset="45%" stopColor="rgb(218 223 230 / 0.9)" />
              <stop offset="100%" stopColor="rgb(120 127 136 / 0.9)" />
            </linearGradient>
            <linearGradient id="string-wound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(236 222 191 / 0.9)" />
              <stop offset="45%" stopColor="rgb(182 161 124 / 0.92)" />
              <stop offset="100%" stopColor="rgb(108 96 74 / 0.92)" />
            </linearGradient>
            <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#4DE4FF" floodOpacity="0.65" />
            </filter>
            <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#FF9A4D" floodOpacity="0.65" />
            </filter>
          </defs>

          {/* Wood background */}
          <rect x={0} y={0} width={neckWidthPx} height={neckHeight} fill="url(#fretboard-wood)" />
          <rect x={0} y={0} width={neckWidthPx} height={neckHeight} fill="url(#wood-grain)" opacity={0.85} />
          <rect x={0} y={0} width={neckWidthPx} height={neckHeight} fill="url(#fretboard-vignette)" />

          {/* Nut */}
          {startFret === 0 && (
            <g>
              <rect
                x={0}
                y={0}
                width={NUT_WIDTH}
                height={neckHeight}
                fill="var(--nut)"
                opacity={0.9}
              />
              <line
                x1={NUT_WIDTH - 1}
                y1={0}
                x2={NUT_WIDTH - 1}
                y2={neckHeight}
                stroke="rgb(255 255 255 / 0.45)"
                strokeWidth={1}
              />
            </g>
          )}

          {/* Fret wires */}
          {Array.from({ length: totalColumns }).map((_, idx) => {
            const fretIndex = startFret + idx;
            if (fretIndex === 0) return null;
            const x = idx * effectiveZoom;
            return (
              <g key={`fw-${fretIndex}`}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={neckHeight}
                  stroke="var(--fret-wire-dark)"
                  strokeWidth={2.8}
                  opacity={0.65}
                />
                <line
                  x1={x + 0.4}
                  y1={0}
                  x2={x + 0.4}
                  y2={neckHeight}
                  stroke="var(--fret-wire-v2)"
                  strokeWidth={1.25}
                  opacity={0.98}
                />
                <line
                  x1={x + 0.85}
                  y1={0}
                  x2={x + 0.85}
                  y2={neckHeight}
                  stroke="rgb(255 255 255 / 0.32)"
                  strokeWidth={0.55}
                  opacity={0.8}
                />
              </g>
            );
          })}

          {/* Inlay dots */}
          {Array.from({ length: totalColumns }).map((_, idx) => {
            const fretIndex = startFret + idx;
            if (INLAY_FRETS.includes(fretIndex)) {
              const x = fretCenterX(fretIndex);
              return (
                <circle
                  key={`inlay-${fretIndex}`}
                  data-fret-marker={fretIndex}
                  cx={x}
                  cy={inlayY}
                  r={inlayR}
                  fill="var(--inlay-dot)"
                />
              );
            }
            if (INLAY_DOUBLE_FRETS.includes(fretIndex)) {
              const x = fretCenterX(fretIndex);
              return (
                <g key={`inlay-${fretIndex}`} data-fret-marker={fretIndex} data-double-marker="true">
                  <circle cx={x} cy={inlayYTop} r={inlayR} fill="var(--inlay-dot-12)" />
                  <circle cx={x} cy={inlayYBottom} r={inlayR} fill="var(--inlay-dot-12)" />
                </g>
              );
            }
            return null;
          })}

          {/* Strings — tapered SVG lines */}
          {tuning.map((_openString, stringIndex) => {
            const y = stringCenterY(stringIndex);
            const isBass = stringIndex >= 3;
            return (
              <g key={`string-${stringIndex}`}>
                <line
                  x1={0}
                  y1={y + 0.6}
                  x2={neckWidthPx}
                  y2={y + 0.6}
                  stroke="rgb(0 0 0 / 0.32)"
                  style={{ strokeWidth: `calc(var(--string-taper-${stringIndex + 1}) + 0.55px)` }}
                  strokeLinecap="round"
                />
                <line
                  x1={0}
                  y1={y}
                  x2={neckWidthPx}
                  y2={y}
                  stroke={isBass ? "url(#string-wound)" : "url(#string-plain)"}
                  style={{ strokeWidth: `var(--string-taper-${stringIndex + 1})` }}
                  strokeLinecap="round"
                  className={`fretboard-string fretboard-string-${stringIndex + 1}`}
                />
              </g>
            );
          })}

          {/* Shape polygons overlay */}
          {svgPolygons.length > 0 && svgPolygons.map(({ points, color, key }) => (
            <polygon key={key} points={points} fill={color} stroke="none" />
          ))}

          {/* Note circles (outlined-glow) — visual only, aria-hidden SVG */}
          {noteData.map(({ stringIndex, fretIndex, noteClass, displayValue, applyDimOpacity, isHidden }) => {
            if (noteClass === "note-inactive") return null;
            const cx = fretCenterX(fretIndex);
            const cy = stringCenterY(stringIndex);
            const baseRadius = noteBubblePx / 2;
            const {
              stroke,
              filter,
              fill,
              textFill,
              radiusScale,
              strokeWidth,
              coreFill,
              coreOpacity,
              textOpacity,
            } = getNoteVisuals(noteClass);
            const r = baseRadius * radiusScale;
            return (
              <g
                key={`note-${stringIndex}-${fretIndex}`}
                className={clsx("fretboard-note", noteClass, isHidden && "hidden")}
                style={{ opacity: applyDimOpacity ? 0.8 : 1 }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  filter={filter !== "none" ? filter : undefined}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={Math.max(0, r * 0.62)}
                  fill={coreFill}
                  opacity={coreOpacity}
                  pointerEvents="none"
                />
                {displayFormat !== "none" && (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={noteFontPx}
                    fontWeight={700}
                    fill={textFill}
                    opacity={textOpacity}
                    style={{
                      pointerEvents: "none",
                      userSelect: "none",
                      paintOrder: "stroke",
                      stroke: "rgb(0 0 0 / 0.45)",
                      strokeWidth: noteClass === "root-active" ? 2.3 : 1.8,
                    }}
                  >
                    {formatAccidental(displayValue)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Accessible button layer — transparent, positioned over SVG circles */}
        <div
          className="fretboard-a11y-layer"
          style={{ position: "absolute", top: NECK_BORDER, left: NECK_BORDER, width: neckWidthPx, height: neckHeight }}
        >
          {noteData.map(({ stringIndex, fretIndex, noteClass, displayValue, isHidden }) => {
            if (noteClass === "note-inactive") return null;
            const cx = fretCenterX(fretIndex);
            const cy = stringCenterY(stringIndex);
            const r = noteBubblePx / 2;
            return (
              <button
                key={`btn-${stringIndex}-${fretIndex}`}
                type="button"
                onClick={onNoteClick ? () => onNoteClick(stringIndex, fretIndex, fretboardLayout[stringIndex][fretIndex]) : undefined}
                disabled={!onNoteClick}
                aria-label={`${formatAccidental(displayValue)} on string ${stringIndex + 1}, fret ${fretIndex}`}
                className={clsx("note-bubble", noteClass, isHidden && "hidden")}
                style={{
                  position: "absolute",
                  left: cx - r,
                  top: cy - r,
                  width: noteBubblePx,
                  height: noteBubblePx,
                  fontSize: `${noteFontPx}px`,
                  opacity: 0,
                  pointerEvents: onNoteClick ? "auto" : "none",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Fret numbers row — rendered AFTER the board in DOM order */}
      <div
        className="fret-numbers-row"
        style={{ width: `${neckWidthPx + NECK_BORDER * 2}px`, paddingLeft: `${NECK_BORDER}px` }}
      >
        {Array.from({ length: totalColumns }).map((_, idx) => {
          const fretIndex = startFret + idx;
          return (
            <span key={`fn-${fretIndex}`} className="fret-number" style={{ width: `${effectiveZoom}px` }}>
              {fretIndex}
            </span>
          );
        })}
      </div>

      {shapeLabels !== "none" && svgPolygons.length > 0 && (
        <div className="shape-labels-row" style={{ width: `${neckWidthPx + NECK_BORDER * 2}px` }}>
          {svgPolygons.map(({ key, poly, centerX }) => {
            if (poly.truncated) return null;
            return (
              <span key={key} className="shape-label" style={{ left: `${centerX + NECK_BORDER}px` }}>
                {poly.cagedLabel}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
