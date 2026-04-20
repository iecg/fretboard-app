import { useId, useMemo, useCallback, memo, useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { clsx } from "clsx";
import {
  NOTES,
  ENHARMONICS,
  getNoteDisplay,
  getNoteDisplayInScale,
  INTERVAL_NAMES,
  formatAccidental,
  SCALES,
  type PracticeLens,
  type NoteSemantics,
} from "./theory";
import { parseNote } from "./guitar";
import { STRING_ROW_PX_TABLET } from "./layout/responsive";
import "./FretboardSVG.css";
import type { ShapePolygon, CagedShape } from "./shapes";
import type { ActiveShapeType } from "./hooks/useFretboardState";
import {
  NECK_BORDER,
  NUT_WIDTH,
  INLAY_FRETS,
  INLAY_DOUBLE_FRETS,
  MAX_FRET,
  NOTE_BUBBLE_RATIO,
  NOTE_FONT_RATIO,
  NECK_TAPER_SCALE,
  STRING_OCCUPY_FRAC,
  STRING_SPREAD_LEFT_FRAC,
  INLAY_RADIUS_RATIO,
  INLAY_RADIUS_MIN,
  RADIUS_SCALE_KEY_TONIC,
  RADIUS_SCALE_CHORD_ROOT,
  RADIUS_SCALE_CHORD_TONE,
  RADIUS_SCALE_NOTE_ACTIVE,
  RADIUS_SCALE_COLOR_TONE,
  RADIUS_SCALE_DEFAULT,
} from "./constants";

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

type BoxBound = { minFret: number; maxFret: number };

type LensEmphasis = {
  glowColor?: "cyan" | "orange" | "violet";
  radiusBoost: number;
  opacityBoost: number;
};

function getLensEmphasis(
  noteClass: string,
  practiceLens: PracticeLens | undefined,
  isGuideTone: boolean,
  isTension: boolean,
): LensEmphasis {
  const defaultEmphasis: LensEmphasis = { radiusBoost: 1, opacityBoost: 1 };

  if (!practiceLens) return defaultEmphasis;

  switch (practiceLens) {
    case "guide-tones":
      if (isGuideTone) {
        return { glowColor: "cyan", radiusBoost: 1.15, opacityBoost: 1 };
      }
      if (noteClass.includes("chord-") || noteClass.includes("color-")) {
        return { radiusBoost: 0.85, opacityBoost: 0.7 };
      }
      return defaultEmphasis;

    case "tension":
      if (isTension) {
        return { glowColor: "orange", radiusBoost: 1.15, opacityBoost: 1 };
      }
      if (noteClass.includes("chord-")) {
        return { radiusBoost: 0.85, opacityBoost: 0.7 };
      }
      return defaultEmphasis;

    case "targets":
    default:
      return defaultEmphasis;
  }
}

// Roles: key-tonic, chord-root, chord-tone-in-scale, chord-tone-outside-scale,
//        color-tone, scale-only, note-active, color-note, note-inactive
function classifyNote(
  isScaleRoot: boolean,
  isChordRootNote: boolean,
  isColorNote: boolean,
  isHighlighted: boolean,
  isChordTone: boolean,
  hasChordOverlay: boolean,
  isChordInRange: boolean,
  isInActiveShape: boolean,
  shapePolygons: ShapePolygon[],
  boxBounds: BoxBound[],
  fretIndex: number,
): string {
  if (!hasChordOverlay) {
    if (isColorNote && isHighlighted) return "color-note";
    if (isScaleRoot && isHighlighted) return "key-tonic";
    if (isHighlighted) return "note-active";
    if (
      isColorNote &&
      shapePolygons.length > 0 &&
      boxBounds.some(
        (b) => fretIndex >= b.minFret - 1 && fretIndex <= b.maxFret + 1,
      )
    )
      return "color-note";
    return "note-inactive";
  }
  // Chord overlay active: chord-root takes priority (even if outside scale).
  // With pattern-aware rendering, skip chord notes outside the active shape.
  if (isChordRootNote && isChordTone && isChordInRange && isInActiveShape) return "chord-root";
  if (isHighlighted && isChordTone && isChordInRange && isInActiveShape) return "chord-tone-in-scale";
  // Color/characteristic tone: shape-aware gate prevents leakage outside active shape.
  if (isHighlighted && isColorNote && isInActiveShape) return "color-tone";
  // In-scale notes: shape-aware gate — outside the active shape → note-inactive.
  if (isHighlighted && isInActiveShape) return "scale-only";
  if (!isHighlighted && isChordTone && isChordInRange && isInActiveShape)
    return "chord-tone-outside-scale";
  return "note-inactive";
}

// Chord-root + isTension can coexist: outside-scale root stays "chord-root" (squircle/identity).
function classifyNoteFromSemantics(
  sem: NoteSemantics,
  isChordInRange: boolean,
  isInActiveShape: boolean,
  hasChordOverlay: boolean,
  isHighlighted: boolean,
  shapePolygons: ShapePolygon[],
  boxBounds: BoxBound[],
  fretIndex: number,
): string {
  if (!hasChordOverlay) {
    // Delegate to classifyNote to avoid duplicating the no-overlay logic.
    // isHighlighted (position/shape-aware) must be passed, not sem.isInScale (pitch-only).
    return classifyNote(
      sem.isScaleRoot, sem.isChordRoot, sem.isColorTone, isHighlighted,
      sem.isChordTone, hasChordOverlay, isChordInRange, isInActiveShape, shapePolygons, boxBounds, fretIndex,
    );
  }
  // Chord overlay active: chord-root takes absolute priority, even if outside scale.
  // With pattern-aware rendering, skip chord notes outside the active shape.
  if (sem.isChordRoot && sem.isChordTone && isChordInRange && isInActiveShape) return "chord-root";
  // In-scale chord tones.
  if (sem.isInScale && sem.isChordTone && isChordInRange && isInActiveShape) return "chord-tone-in-scale";
  // Color/characteristic tone: isInActiveShape (shape-aware) gates containment.
  if (sem.isInScale && sem.isColorTone && isInActiveShape && isHighlighted) return "color-tone";
  // Other in-scale notes: shape-aware gate — outside the active shape → note-inactive.
  if (sem.isInScale && isInActiveShape && isHighlighted) return "scale-only";
  // Out-of-scale chord tones (tension, non-root) within the shape.
  if (sem.isChordTone && isChordInRange && isInActiveShape) return "chord-tone-outside-scale";
  // Everything else outside the active shape: suppress entirely.
  return "note-inactive";
}

type NoteShape = "circle" | "squircle" | "diamond" | "hexagon";

type NoteVisuals = {
  radiusScale: number;
  noteShape: NoteShape;
};

function getNoteVisuals(
  noteClass: string,
): NoteVisuals {
  switch (noteClass) {
    case "key-tonic":
      return {
        radiusScale: RADIUS_SCALE_KEY_TONIC,
        noteShape: "circle",
      };
    case "chord-root":
      return {
        radiusScale: RADIUS_SCALE_CHORD_ROOT,
        noteShape: "squircle",
      };
    case "chord-tone-in-scale":
      return {
        radiusScale: RADIUS_SCALE_CHORD_TONE,
        noteShape: "squircle",
      };
    case "note-active":
      return {
        radiusScale: RADIUS_SCALE_NOTE_ACTIVE,
        noteShape: "circle",
      };
    case "color-note":
      return {
        radiusScale: RADIUS_SCALE_NOTE_ACTIVE,
        noteShape: "hexagon",
      };
    case "scale-only":
      return {
        radiusScale: RADIUS_SCALE_NOTE_ACTIVE,
        noteShape: "circle",
      };
    case "color-tone":
      return {
        radiusScale: RADIUS_SCALE_COLOR_TONE,
        noteShape: "hexagon",
      };
    case "chord-tone-outside-scale":
      return {
        radiusScale: RADIUS_SCALE_CHORD_TONE,
        noteShape: "diamond",
      };
    default:
      return {
        radiusScale: RADIUS_SCALE_DEFAULT,
        noteShape: "circle",
      };
  }
}

/** Pre-rasterizes the three feTurbulence wood-grain layers to a PNG dataURL so
 *  the browser can GPU-composite it during scroll instead of re-running
 *  CPU-bound fractalNoise every frame. */
function useWoodGrainTexture(width: number, height: number): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const prevKey = useRef('');

  useEffect(() => {
    const key = `${width}x${height}`;
    if (key === prevKey.current || width <= 0 || height <= 0) return;
    prevKey.current = key;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <filter id="wg" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.95" numOctaves="2" seed="3" result="grain"/>
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.09 0 0 0 0 0.05 0 0 0 0 0.03 0 0 0 0.72 0" result="grainTinted"/>
          <feComposite in="grainTinted" in2="SourceGraphic" operator="in"/>
        </filter>
        <filter id="wh" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022 0.55" numOctaves="1" seed="11" result="hl"/>
          <feColorMatrix in="hl" type="matrix" values="0 0 0 0 0.32 0 0 0 0 0.21 0 0 0 0 0.12 0 0 0 0.09 0"/>
        </filter>
        <filter id="wp" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55 0.55" numOctaves="1" seed="23" result="pores"/>
          <feColorMatrix in="pores" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="#000" filter="url(#wg)" opacity="0.92"/>
      <rect width="${width}" height="${height}" fill="#000" filter="url(#wh)" opacity="0.6"/>
      <rect width="${width}" height="${height}" fill="#000" filter="url(#wp)" opacity="0.5"/>
    </svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      try { setDataUrl(canvas.toDataURL('image/png')); } catch { /* tainted canvas — stay on live filters */ }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [width, height]);

  return dataUrl;
}

const FretboardBackground = memo(({
  neckWidthPx, 
  neckHeight, 
  startFret, 
  maxFret, 
  tuning, 
  stringYAt, 
  wireXRel, 
  svgDefUrl, 
  taperYLeft,
  inlays
}: {
  neckWidthPx: number;
  neckHeight: number;
  startFret: number;
  maxFret: number;
  tuning: string[];
  stringYAt: (s: number, x: number) => number;
  wireXRel: (wireIndex: number) => number;
  svgDefUrl: (id: string) => string;
  taperYLeft: number;
  inlays: ReactNode[];
}) => {
  const woodGrainDataUrl = useWoodGrainTexture(neckWidthPx, neckHeight);

  const woodStack = (
    <>
      <rect x={0} y={0} width={neckWidthPx} height={neckHeight} fill={svgDefUrl("fretboard-wood")} />
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
          <rect x={0} y={0} width={neckWidthPx} height={neckHeight} fill="#000" filter={svgDefUrl("wood-grain-filter")} opacity={0.92} />
          <rect x={0} y={0} width={neckWidthPx} height={neckHeight} fill="#000" filter={svgDefUrl("wood-highlights-filter")} opacity={0.6} />
          <rect x={0} y={0} width={neckWidthPx} height={neckHeight} fill="#000" filter={svgDefUrl("wood-pores-filter")} opacity={0.5} />
        </>
      )}
      <rect x={0} y={0} width={neckWidthPx} height={neckHeight} fill={svgDefUrl("fretboard-vignette")} />
    </>
  );

  const fretWires = [];
  const wireThickness = 4;
  const wireStart = startFret === 0 ? 1 : startFret - 1;
  for (let wireIdx = wireStart; wireIdx < maxFret; wireIdx++) {
    const x = wireXRel(wireIdx);
    fretWires.push(
      <g key={`fw-${wireIdx}`}>
        <rect x={x + 0.6} y={0} width={wireThickness} height={neckHeight} fill="rgb(0 0 0 / 0.45)" />
        <rect x={x - wireThickness / 2} y={0} width={wireThickness} height={neckHeight} fill={svgDefUrl("fret-wire-cylinder")} />
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
          x1={0} y1={yLeft + 1.8} x2={neckWidthPx} y2={yRight + 1.8}
          stroke="rgb(0 0 0 / 0.7)"
          style={{ strokeWidth: `calc(var(--string-taper-${stringIndex + 1}) + 1.4px)` }}
          strokeLinecap="round"
          filter={svgDefUrl("string-shadow-blur")}
        />
        <line
          x1={0} y1={yLeft} x2={neckWidthPx} y2={yRight}
          stroke={isBass ? "#c6ccd2" : "#e4e8ee"}
          style={{ strokeWidth: `var(--string-taper-${stringIndex + 1})` }}
          strokeLinecap="round"
          className={`fretboard-string fretboard-string-${stringIndex + 1}`}
        />
        {isBass && (
          <line
            x1={0} y1={yLeft} x2={neckWidthPx} y2={yRight}
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
          <rect x={0} y={0} width={Math.max(0, nutRightX - NUT_WIDTH)} height={neckHeight} fill="#07050a" />
        )}
        {startFret === 0 && (
          <g>
            <rect x={nutLeftX} y={0} width={NUT_WIDTH} height={neckHeight} fill={svgDefUrl("nut-material")} />
            <line x1={nutLeftX} y1={0.5} x2={nutRightX} y2={0.5} stroke="rgb(255 252 240 / 0.85)" strokeWidth={1} />
            <line x1={nutLeftX} y1={neckHeight - 0.5} x2={nutRightX} y2={neckHeight - 0.5} stroke="rgb(0 0 0 / 0.5)" strokeWidth={1} />
            <line x1={nutRightX - 0.5} y1={0} x2={nutRightX - 0.5} y2={neckHeight} stroke="rgb(0 0 0 / 0.55)" strokeWidth={0.6} />
            {tuning.map((_, i) => (
              <rect key={`nut-slot-${i}`} x={nutRightX - 2} y={stringYAt(i, nutRightX) - 0.9} width={2.4} height={1.8} rx={0.9} fill="rgb(12 8 4 / 0.55)" />
            ))}
          </g>
        )}
        {fretWires}
        {inlays}
        {strings}
      </g>
      <path d={`M 0 ${taperYLeft} L ${neckWidthPx} 0`} stroke="rgb(218 182 138 / 0.22)" strokeWidth={0.9} fill="none" />
      <path d={`M 0 ${neckHeight - taperYLeft} L ${neckWidthPx} ${neckHeight}`} stroke="rgb(0 0 0 / 0.75)" strokeWidth={1} fill="none" />
    </>
  );
});

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

  const { openColumnWidth, scaleLeftAnchor, scalePx } = useMemo(() => {
    const openWidth = startFret === 0 ? Math.max(noteBubblePx + 12, NUT_WIDTH + 4) : 0;
    const leftAnchor = startFret === 0 ? 1 : Math.pow(2, -(startFret - 1) / 12);
    const rightAnchor = Math.pow(2, -endFret / 12);
    const range = leftAnchor - rightAnchor || 1;
    const px = (neckWidthPx - openWidth) / range;
    return { openColumnWidth: openWidth, scaleLeftAnchor: leftAnchor, scalePx: px };
}, [startFret, endFret, neckWidthPx, noteBubblePx]);

  const wireXRel = useCallback((wireIndex: number): number => {
    if (startFret === 0 && wireIndex === 0) {
      return openColumnWidth;
    }
    return (
      openColumnWidth +
      scalePx * (scaleLeftAnchor - Math.pow(2, -wireIndex / 12))
    );
  }, [startFret, openColumnWidth, scalePx, scaleLeftAnchor]);

  const fretToX = useCallback((fret: number): number => {
    if (startFret === 0 && fret === 0) {
      return openColumnWidth / 2;
    }
    const leftWire = fret === 0 ? 0 : wireXRel(fret - 1);
    const rightWire = wireXRel(fret);
    return (leftWire + rightWire) / 2;
  }, [startFret, openColumnWidth, wireXRel]);

  const fretColumnWidth = useCallback((fret: number): number => {
    if (startFret === 0 && fret === 0) return openColumnWidth;
    const leftWire = fret === 0 ? 0 : wireXRel(fret - 1);
    const rightWire = wireXRel(fret);
    return rightWire - leftWire;
  }, [startFret, openColumnWidth, wireXRel]);

  const { taperYLeft, taperPath } = useMemo(() => {
    const fretDistRatio = (wireIdx: number) => 1 - Math.pow(2, -wireIdx / 12);
    const pLeft = startFret === 0 ? 0 : fretDistRatio(startFret - 1);
    const pRight = fretDistRatio(endFret);
    const neckWidthAt = (p: number) => 1 + NECK_TAPER_SCALE * p;
    const leftHeightRatio = neckWidthAt(pLeft) / neckWidthAt(pRight);
    const yLeft = Math.round((neckHeight * (1 - leftHeightRatio)) / 2);

    const cornerR = endFret === maxFret ? Math.min(Math.round(neckHeight * 0.08), 22) : 0;
    const path =
      `M 0 ${yLeft} ` +
      `L ${neckWidthPx - cornerR} 0 ` +
      `Q ${neckWidthPx} 0 ${neckWidthPx} ${cornerR} ` +
      `L ${neckWidthPx} ${neckHeight - cornerR} ` +
      `Q ${neckWidthPx} ${neckHeight} ${neckWidthPx - cornerR} ${neckHeight} ` +
      `L 0 ${neckHeight - yLeft} Z`;
    
    return { taperYLeft: yLeft, taperPath: path };
  }, [startFret, endFret, neckHeight, neckWidthPx, maxFret]);

  const stringYAt = useCallback((s: number, x: number): number => {
    const xFrac = neckWidthPx > 0 ? Math.max(0, Math.min(1, x / neckWidthPx)) : 0;
    const localSpread = (STRING_SPREAD_LEFT_FRAC + (1 - STRING_SPREAD_LEFT_FRAC) * xFrac) * neckHeight * STRING_OCCUPY_FRAC;
    const t = numStrings > 1 ? s / (numStrings - 1) : 0.5;
    return neckHeight / 2 - localSpread / 2 + t * localSpread;
  }, [neckWidthPx, neckHeight, numStrings]);

  const fretCenterX = useCallback((fret: number) => fretToX(fret), [fretToX]);

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

  /* Inlay positions follow the local (tapered) neck geometry — single
     inlays sit at the vertical centre, double (12 / 24) inlays sit between
     string pairs 1–2 and (N-2)–(N-1). */
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

  const noteData = useMemo(() => {
    const notes = [];
    const scale = SCALES[scaleName] || [];
    const normRoot = rootNote && (ENHARMONICS[rootNote]?.includes("b") ? ENHARMONICS[rootNote] : rootNote);
    const rootIdx = rootNote ? NOTES.indexOf(normRoot.includes("#") ? normRoot : rootNote) : -1;

    // Pre-calculate normalized hidden notes for faster lookup
    const normalizedHidden = new Set<string>();
    if (hiddenNotes && hiddenNotes.size > 0) {
      hiddenNotes.forEach(n => {
        normalizedHidden.add(n);
        // Also hide enharmonic equivalents if it's a note name
        const enh = ENHARMONICS[n];
        if (enh) normalizedHidden.add(enh);
      });
    }

    // Pre-calculate highlighted notes set for faster lookup
    const highlightSet = new Set(highlightNotes);

    // Pre-calculate chord tones set
    const chordToneSet = new Set(chordTones);

    // Pre-calculate color notes set
    const colorNoteSet = new Set(colorNotes);

    for (let stringIndex = 0; stringIndex < numStrings; stringIndex++) {
      const layoutRow = fretboardLayout[stringIndex];
      const openNoteName = parseNote(tuning[stringIndex])?.noteName;

      for (let idx = 0; idx <= totalColumns; idx++) {
        const fretIndex = startFret + idx;
        if (fretIndex >= maxFret) continue;

        const noteName = layoutRow[fretIndex];

        const isNoteHidden = normalizedHidden.has(noteName) || normalizedHidden.has(`${stringIndex}-${fretIndex}`);

        const isHighlighted =
          !isNoteHidden &&
          (highlightSet.has(noteName) ||
            highlightSet.has(`${stringIndex}-${fretIndex}`));
        
        const isChordTone =
          !isNoteHidden && hasChordOverlay && chordToneSet.has(noteName);
        
        const isScaleRoot =
          !isNoteHidden &&
          (noteName === rootNote ||
            ENHARMONICS[noteName] === rootNote ||
            ENHARMONICS[rootNote] === noteName);
        
        const isChordRootNote =
          !isNoteHidden &&
          !!chordRoot &&
          (noteName === chordRoot ||
            ENHARMONICS[noteName] === chordRoot ||
            ENHARMONICS[chordRoot] === noteName);
        
        const isColorNote = !!(!isNoteHidden && colorNoteSet.size > 0 && (
          colorNoteSet.has(noteName) || 
          (ENHARMONICS[noteName] && colorNoteSet.has(ENHARMONICS[noteName]!))
        ));

        const isInsideAnyPolygon = shapePolygons.some((poly) => {
          const leftFret = poly.vertices[stringIndex]?.fret;
          const rightFret =
            poly.vertices[poly.vertices.length - 1 - stringIndex]?.fret;
          return (
            leftFret !== undefined &&
            rightFret !== undefined &&
            fretIndex >= leftFret &&
            fretIndex <= rightFret
          );
        });

        // Shape-aware, spread-aware playable context.
        // True when this note coordinate should receive chord overlay emphasis.
        // Checks only the active shape(s) — not all polygons — so the spread
        // buffer correctly extends the active shape boundary, not any visible shape.
        const isInPlayableContext: boolean = (() => {
          if (!hasChordOverlay) return false;
          // 3NPS has no polygon shapes; gate chord overlay by aggregate fret bounds
          if (activePattern === "3nps" && shapeScope !== "global" && boxBounds.length > 0) {
            return boxBounds.some(
              (b) =>
                fretIndex >= b.minFret - chordFretSpread &&
                fretIndex <= b.maxFret + chordFretSpread,
            );
          }
          if (shapePolygons.length === 0 || !activePattern) return true;
          if (shapeScope === "global") return true;
          return shapePolygons.some((poly) => {
            if (shapeScope === "single") {
              if (activePattern === "caged" && poly.shape !== activeShape) return false;
              if (activePattern === "3nps" && poly.shape !== activeShape) return false;
            } else if (shapeScope === "multi" && Array.isArray(activeShape)) {
              if (!(activeShape as CagedShape[]).includes(poly.shape as CagedShape)) return false;
            }
            const leftFret = poly.vertices[stringIndex]?.fret;
            const rightFret = poly.vertices[poly.vertices.length - 1 - stringIndex]?.fret;
            return (
              leftFret !== undefined &&
              rightFret !== undefined &&
              fretIndex >= leftFret - chordFretSpread &&
              fretIndex <= rightFret + chordFretSpread
            );
          });
        })();

        // Both range and shape-membership now derive from the same computation.
        const isChordInRange = isInPlayableContext;
        const isInActiveShape = isInPlayableContext || !hasChordOverlay || !activePattern;

        // Use the composable semantic model when available; fall back to booleans.
        // Keys are sharp-normalized (per project convention) so no enharmonic lookup needed.
        const semantics = noteSemantics?.get(noteName);

        const noteClass = isNoteHidden
          ? "note-inactive"
          : semantics
            ? classifyNoteFromSemantics(
                semantics,
                isChordInRange,
                isInActiveShape,
                hasChordOverlay,
                isHighlighted,
                shapePolygons,
                boxBounds,
                fretIndex,
              )
            : classifyNote(
                isScaleRoot,
                isChordRootNote,
                isColorNote,
                isHighlighted,
                isChordTone,
                hasChordOverlay,
                isChordInRange,
                isInActiveShape,
                shapePolygons,
                boxBounds,
                fretIndex,
              );

        if (noteClass === "note-inactive") continue;

        let displayValue = getNoteDisplayInScale(
          noteName,
          rootNote,
          scale,
          useFlats,
        );
        if (displayFormat === "degrees" && rootNote) {
          const noteIdx = NOTES.indexOf(noteName);
          if (rootIdx !== -1 && noteIdx !== -1) {
            displayValue = INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
          }
        } else if (
          fretIndex === 0 &&
          openNoteName === noteName
        ) {
          displayValue = getNoteDisplayInScale(
            noteName,
            rootNote,
            scale,
            useFlats,
          );
        }

        const isWrapped = wrappedNotes.has(`${stringIndex}-${fretIndex}`);
        const applyDimOpacity =
          (shapePolygons.length > 0 &&
            !isInsideAnyPolygon &&
            (noteClass === "color-note" ||
              noteClass === "chord-tone-outside-scale" ||
              noteClass === "chord-tone-in-scale" ||
              noteClass === "chord-root" ||
              noteClass === "key-tonic")) ||
          (isWrapped && isHighlighted);

        // Lens emphasis only applies when chord overlay is active.
        // Without an overlay, no lens-driven dimming or emphasis should alter scale notes.
        const lensEmphasis = getLensEmphasis(
          noteClass,
          hasChordOverlay ? practiceLens : undefined,
          semantics?.isGuideTone ?? false,
          semantics?.isTension ?? false,
        );

        const isHidden = false;

        notes.push({
          stringIndex,
          fretIndex,
          noteName,
          noteClass,
          displayValue,
          applyDimOpacity,
          applyLensEmphasis: lensEmphasis,
          isHidden,
          isTension: semantics?.isTension ?? false,
          isGuideTone: semantics?.isGuideTone ?? false,
        });
      }
    }
    return notes;
  }, [numStrings, fretboardLayout, totalColumns, startFret, maxFret, hiddenNotes, highlightNotes, hasChordOverlay, chordTones, rootNote, chordRoot, colorNotes, shapePolygons, boxBounds, chordFretSpread, scaleName, useFlats, displayFormat, wrappedNotes, practiceLens, tuning, noteSemantics, activePattern, activeShape, shapeScope]);

  return (
    <div role="group" aria-label={ariaLabel} className="fretboard-board" data-practice-lens={hasChordOverlay ? practiceLens : undefined}>
      <div
        className="fretboard-neck"
        style={
          {
            height: `${neckHeight + NECK_BORDER * 2}px`,
            width: `${neckWidthPx + NECK_BORDER * 2}px`,
            willChange: "transform",
            "--string-row-px": `${stringRowPx}px`,
            "--glow-cyan": glowFilterUrls.cyan,
            "--glow-orange": glowFilterUrls.orange,
            "--glow-violet": glowFilterUrls.violet,
          } as CSSProperties
        }
      >
        {/* Visual SVG — aria-hidden; accessible buttons rendered separately below */}
        <svg
          className="fretboard-main-svg"
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
            {/* Side-to-side vignette — edges slightly darker than centre. */}
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
            {/* Deep ebony grain — long, tight horizontal streaks. */}
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
            {/* Warmer mid-tone streaks — rare but visible ribbons of brown. */}
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
            {/* Fine pore noise — tight speckle to break up solid areas. */}
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
            {/* Strings use solid colours (not objectBoundingBox gradients) — on
                 thin horizontal lines a y-axis gradient collapses because the
                 element's bounding box has near-zero height. */}
            {/* Soft cast shadow under each string — blurs a dark offset line.
                filterUnits=userSpaceOnUse so the filter region isn't sized to
                the line's zero-height bbox. */}
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
            {/* Bone nut — near-pure white with a subtle grey shadow for depth. */}
            <linearGradient id={svgDefId("nut-material")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#f4f4f1" />
              <stop offset="75%" stopColor="#d8d4cb" />
              <stop offset="100%" stopColor="#a9a59b" />
            </linearGradient>
            {/* Fret wire — horizontal gradient simulates a cylindrical crown
                with a bright silver highlight down the centre. */}
            <linearGradient
              id={svgDefId("fret-wire-cylinder")}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="#3e444c" />
              <stop offset="25%" stopColor="#a6afbc" />
              <stop offset="50%" stopColor="#ebeff5" />
              <stop offset="75%" stopColor="#a6afbc" />
              <stop offset="100%" stopColor="#3e444c" />
            </linearGradient>
            {/* Mother-of-pearl inlay — off-centre hot spot for subtle iridescence. */}
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
            {/* Trapezoidal fretboard silhouette — everything inside the tapered
                region is clipped. Strings, frets, inlays, polygons, and note
                circles all live inside this clip. */}
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
                      "fretboard-note",
                      noteClass,
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
          className="fretboard-a11y-layer"
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
                    "note-bubble",
                    noteClass,
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
        className="fret-numbers-row"
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
              className="fret-number"
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
