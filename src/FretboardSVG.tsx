import { useId, type CSSProperties } from "react";
import { clsx } from "clsx";
import {
  NOTES,
  ENHARMONICS,
  getNoteDisplay,
  getNoteDisplayInScale,
  INTERVAL_NAMES,
  formatAccidental,
  SCALES,
  type ViewMode,
} from "./theory";
import { parseNote } from "./guitar";
import { STRING_ROW_PX_TABLET } from "./layout/responsive";
import "./FretboardSVG.css";
import type { ShapePolygon } from "./shapes";

const NECK_BORDER = 0;
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
  chordRoot?: string;
  chordFretSpread?: number;
  hideNonChordNotes?: boolean;
  viewMode?: ViewMode;
  colorNotes?: string[];
  shapePolygons?: ShapePolygon[];
  wrappedNotes?: Set<string>;
  hiddenNotes?: Set<string>;
  useFlats?: boolean;
  scaleName?: string;
  onNoteClick?: (
    stringIndex: number,
    fretIndex: number,
    noteName: string,
  ) => void;
}

type BoxBound = { minFret: number; maxFret: number };

// Roles: key-tonic, chord-root, chord-tone-in-scale, chord-tone-outside-scale,
//        scale-only, note-active, note-blue, note-inactive
function classifyNote(
  isScaleRoot: boolean,
  isChordRootNote: boolean,
  isColorNote: boolean,
  isHighlighted: boolean,
  isChordTone: boolean,
  hasChordOverlay: boolean,
  isChordInRange: boolean,
  shapePolygons: ShapePolygon[],
  boxBounds: BoxBound[],
  fretIndex: number,
): string {
  if (!hasChordOverlay) {
    if (isColorNote && isHighlighted) return "note-blue";
    if (isScaleRoot && isHighlighted) return "key-tonic";
    if (isHighlighted) return "note-active";
    if (
      isColorNote &&
      shapePolygons.length > 0 &&
      boxBounds.some(
        (b) => fretIndex >= b.minFret - 1 && fretIndex <= b.maxFret + 1,
      )
    )
      return "note-blue";
    return "note-inactive";
  }
  // Chord overlay active: chord-root takes priority (even if outside scale).
  if (isChordRootNote && isChordTone && isChordInRange) return "chord-root";
  if (isHighlighted && isChordTone) return "chord-tone-in-scale";
  if (isHighlighted) return "scale-only";
  if (!isHighlighted && isChordTone && isChordInRange)
    return "chord-tone-outside-scale";
  return "note-inactive";
}

type NoteVisuals = {
  stroke: string;
  filter: string;
  fill: string;
  textFill: string;
  radiusScale: number;
  strokeWidth: number;
  textOpacity: number;
  strokeDasharray?: string;
};

function getNoteVisuals(
  noteClass: string,
  glowFilterUrls: { cyan: string; orange: string },
): NoteVisuals {
  switch (noteClass) {
    case "key-tonic":
      return {
        stroke: "var(--note-ring-tonic)",
        filter: glowFilterUrls.orange,
        fill: "rgb(48 32 22 / 0.95)",
        textFill: "#ffffff",
        radiusScale: 0.82,
        strokeWidth: 2.3,
        textOpacity: 1,
      };
    case "chord-root":
      // Amber ring, larger radius — visually dominant among chord tones.
      return {
        stroke: "var(--note-ring-tonic)",
        filter: glowFilterUrls.orange,
        fill: "rgb(55 35 18 / 0.97)",
        textFill: "#ffffff",
        radiusScale: 0.86,
        strokeWidth: 2.5,
        textOpacity: 1,
      };
    case "chord-tone-in-scale":
      // Cyan ring — chord member, in scale, clearly distinct from root.
      return {
        stroke: "var(--note-ring)",
        filter: glowFilterUrls.cyan,
        fill: "rgb(14 30 44 / 0.95)",
        textFill: "#ffffff",
        radiusScale: 0.82,
        strokeWidth: 2.1,
        textOpacity: 1,
      };
    case "note-active":
    case "note-blue":
      return {
        stroke: "var(--note-ring)",
        filter: glowFilterUrls.cyan,
        fill: "rgb(20 30 40 / 0.92)",
        textFill: "#ffffff",
        radiusScale: 0.82,
        strokeWidth: 1.9,
        textOpacity: 1,
      };
    case "scale-only":
      return {
        stroke: "var(--note-ring-dim)",
        filter: glowFilterUrls.cyan,
        fill: "rgb(18 26 34 / 0.85)",
        textFill: "#ffffff",
        radiusScale: 0.78,
        strokeWidth: 1.7,
        textOpacity: 0.82,
      };
    case "chord-tone-outside-scale":
      // Dashed amber-dim border — chord-relevant but outside the current scale.
      return {
        stroke: "var(--neon-orange-dim)",
        filter: glowFilterUrls.orange,
        fill: "rgb(40 22 10 / 0.72)",
        textFill: "#ffffff",
        radiusScale: 0.82,
        strokeWidth: 2.0,
        textOpacity: 0.9,
        strokeDasharray: "5 3",
      };
    default:
      return {
        stroke: "none",
        filter: "none",
        fill: "transparent",
        textFill: "transparent",
        radiusScale: 0.8,
        strokeWidth: 0,
        textOpacity: 0,
      };
  }
}

export function FretboardSVG({
  effectiveZoom,
  neckWidthPx,
  startFret,
  endFret,
  stringRowPx = STRING_ROW_PX_TABLET,
  fretboardLayout,
  tuning,
  maxFret = 25,
  highlightNotes,
  rootNote,
  displayFormat = "notes",
  boxBounds = [],
  chordTones = [],
  chordRoot,
  chordFretSpread = 0,
  hideNonChordNotes = false,
  viewMode = "compare",
  colorNotes = [],
  shapePolygons = [],
  wrappedNotes = new Set<string>(),
  hiddenNotes,
  useFlats = false,
  scaleName = "",
  onNoteClick,
}: FretboardSVGProps) {
  // `effectiveZoom` stays on the prop surface (callers size the scroll area
  // around it) but non-uniform spacing inside this component is derived from
  // neckWidthPx + scale math, so the value isn't read here.
  void effectiveZoom;
  const defsPrefix = `fretboard-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const svgDefId = (id: string) => `${defsPrefix}-${id}`;
  const svgDefUrl = (id: string) => `url(#${svgDefId(id)})`;
  const glowFilterUrls = {
    cyan: svgDefUrl("glow-cyan"),
    orange: svgDefUrl("glow-orange"),
  };
  const noteBubblePx = Math.round(stringRowPx * 0.78);
  const noteFontPx = Math.round(stringRowPx * 0.44);
  const neckHeight = tuning.length * stringRowPx;
  const totalColumns = endFret - startFret;
  const hasChordOverlay = chordTones.length > 0;
  const numStrings = tuning.length;

  /* Non-uniform fret spacing — the 12th-root-of-2 rule. Total neck width
     stays `totalColumns * effectiveZoom`, but frets get progressively
     narrower toward the bridge. For a real guitar, each fret is shorter
     than the previous by a factor of 2^(1/12).

     When `startFret === 0` we reserve a fixed-width column for the open-
     string row and let frets 1..endFret compress within the remaining
     space. Otherwise (scrolled past the nut) the full visible width is
     divided between visible fret wires using the scale rule.

     `wireXRel(n)` returns the pixel position of fret wire `n` (0 = nut)
     relative to the visible left edge. `fretToX(n)` returns the centre of
     fret column `n` (where the note circle + inlay sit). */
  /* Fret 0 column (the open-string "headstock" area) is shrunk to just fit
     a note circle with a little padding — the open column is visual-only
     and shouldn't compete with the scale-accurate frets. */
  const openColumnWidth =
    startFret === 0 ? Math.max(noteBubblePx + 12, NUT_WIDTH + 4) : 0;
  const scaleLeftAnchor =
    startFret === 0 ? 1 : Math.pow(2, -(startFret - 1) / 12);
  const scaleRightAnchor = Math.pow(2, -endFret / 12);
  const scaleRange = scaleLeftAnchor - scaleRightAnchor || 1;
  const scalePx = (neckWidthPx - openColumnWidth) / scaleRange;

  const wireXRel = (wireIndex: number): number => {
    if (startFret === 0 && wireIndex === 0) {
      return openColumnWidth;
    }
    return (
      openColumnWidth +
      scalePx * (scaleLeftAnchor - Math.pow(2, -wireIndex / 12))
    );
  };

  const fretToX = (fret: number): number => {
    if (startFret === 0 && fret === 0) {
      return openColumnWidth / 2;
    }
    const leftWire = fret === 0 ? 0 : wireXRel(fret - 1);
    const rightWire = wireXRel(fret);
    return (leftWire + rightWire) / 2;
  };

  const fretColumnWidth = (fret: number): number => {
    if (startFret === 0 && fret === 0) return openColumnWidth;
    const leftWire = fret === 0 ? 0 : wireXRel(fret - 1);
    const rightWire = wireXRel(fret);
    return rightWire - leftWire;
  };

  /* Neck taper — linear widening from nut to bridge following:
       width(p) = 1 + NECK_TAPER_SCALE * p   where p ∈ [0,1] along scale length
     Real electric guitars (Fender Strat: nut 41.9 mm → heel ~57 mm) widen
     ~36 % total; the fingerboard surface alone tapers ~22 %. We use 0.20,
     which produces a clearly visible, realistic taper at the default fret range
     without reading as distorted. */
  const NECK_TAPER_SCALE = 0.20;
  const fretDistRatio = (wireIdx: number) => 1 - Math.pow(2, -wireIdx / 12);
  const pLeft = startFret === 0 ? 0 : fretDistRatio(startFret - 1);
  const pRight = fretDistRatio(endFret);
  const neckWidthAt = (p: number) => 1 + NECK_TAPER_SCALE * p;
  const leftHeightRatio = neckWidthAt(pLeft) / neckWidthAt(pRight);
  const taperYLeft = Math.round((neckHeight * (1 - leftHeightRatio)) / 2);

  /* Rounded right end (bridge-side corners). Left (nut) end stays sharp
     because the tapered edge already reads cleanly there. */
  const cornerR =
    endFret === maxFret ? Math.min(Math.round(neckHeight * 0.08), 22) : 0;
  const taperPath =
    `M 0 ${taperYLeft} ` +
    `L ${neckWidthPx - cornerR} 0 ` +
    `Q ${neckWidthPx} 0 ${neckWidthPx} ${cornerR} ` +
    `L ${neckWidthPx} ${neckHeight - cornerR} ` +
    `Q ${neckWidthPx} ${neckHeight} ${neckWidthPx - cornerR} ${neckHeight} ` +
    `L 0 ${neckHeight - taperYLeft} Z`;

  /* String spread — strings converge toward the nut, mirroring real guitar
     geometry. On a Fender Strat, E-to-E at nut (35.7 mm) vs bridge (53.3 mm)
     gives a nut/bridge ratio of ~0.67. We use 0.76 — slightly more spread than
     real for readability — giving a visible fan without crowding note circles.
     Decoupled from NECK_TAPER_SCALE so each can be tuned independently. */
  const STRING_OCCUPY_FRAC = 0.86;
  const STRING_SPREAD_LEFT_FRAC = 0.76;
  const stringSpreadAt = (x: number) => {
    const xFrac =
      neckWidthPx > 0 ? Math.max(0, Math.min(1, x / neckWidthPx)) : 0;
    return STRING_SPREAD_LEFT_FRAC + (1 - STRING_SPREAD_LEFT_FRAC) * xFrac;
  };
  const stringYAt = (s: number, x: number): number => {
    const localSpread = stringSpreadAt(x) * neckHeight * STRING_OCCUPY_FRAC;
    const t = numStrings > 1 ? s / (numStrings - 1) : 0.5;
    return neckHeight / 2 - localSpread / 2 + t * localSpread;
  };

  const fretCenterX = (fret: number) => fretToX(fret);

  const svgPolygons = shapePolygons.map((poly, polyIdx) => {
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
    // Only bleed past the edge when at least one vertex is already naturally
    // outside the boundary (template offsets produce negative / over-max fret
    // values). Without this guard, shapes whose template left offset is 0 at
    // rootFret=0 (e.g. A-shape at open position) would be incorrectly pushed
    // to intendedMin (<0), flooding the open-string column.
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
      {
        const fx = fretToX(resolveLeftFret(verts[i].fret));
        pixelPoints.push(`${fx},${stringYAt(verts[i].string, fx)}`);
      }
    }
    pixelPoints.push(
      `${fretToX(resolveLeftFret(verts[halfVerts - 1].fret))},${neckHeight}`,
    );
    pixelPoints.push(
      `${fretToX(resolveRightFret(verts[halfVerts].fret))},${neckHeight}`,
    );
    for (let i = halfVerts; i < verts.length; i++) {
      {
        const fx = fretToX(resolveRightFret(verts[i].fret));
        pixelPoints.push(`${fx},${stringYAt(verts[i].string, fx)}`);
      }
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
  const inlayYAt = () => neckHeight / 2;
  const inlayYTopAt = (x: number) =>
    numStrings >= 4
      ? (stringYAt(1, x) + stringYAt(2, x)) / 2
      : stringYAt(0, x) + (stringYAt(numStrings - 1, x) - stringYAt(0, x)) / 3;
  const inlayYBottomAt = (x: number) =>
    numStrings >= 4
      ? (stringYAt(numStrings - 3, x) + stringYAt(numStrings - 2, x)) / 2
      : stringYAt(0, x) +
        ((stringYAt(numStrings - 1, x) - stringYAt(0, x)) * 2) / 3;
  const inlayR = Math.max(5, stringRowPx * 0.15);

  // Pre-compute note data for both SVG rendering and accessible button layer
  const noteData = tuning.flatMap((_openString, stringIndex) =>
    Array.from({ length: totalColumns + 1 }, (_, idx) => idx).flatMap((idx) => {
      const fretIndex = startFret + idx;
      if (fretIndex >= maxFret) return [];

      const noteName = fretboardLayout[stringIndex][fretIndex];

      const isNoteHidden =
        hiddenNotes != null &&
        hiddenNotes.size > 0 &&
        (hiddenNotes.has(noteName) ||
          !!(ENHARMONICS[noteName] && hiddenNotes.has(ENHARMONICS[noteName])));

      const isHighlighted =
        !isNoteHidden &&
        (highlightNotes.includes(noteName) ||
          highlightNotes.includes(`${stringIndex}-${fretIndex}`));
      const isChordTone =
        !isNoteHidden && hasChordOverlay && chordTones.includes(noteName);
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
      const isColorNote =
        !isNoteHidden &&
        colorNotes.length > 0 &&
        colorNotes.some(
          (cn) =>
            noteName === cn ||
            ENHARMONICS[noteName] === cn ||
            ENHARMONICS[cn] === noteName,
        );
      const isChordInRange =
        !hasChordOverlay ||
        !shapePolygons.length ||
        boxBounds.some(
          (b) =>
            fretIndex >= b.minFret - chordFretSpread &&
            fretIndex <= b.maxFret + chordFretSpread,
        );

      const noteClass = isNoteHidden
        ? "note-inactive"
        : classifyNote(
            isScaleRoot,
            isChordRootNote,
            isColorNote,
            isHighlighted,
            isChordTone,
            hasChordOverlay,
            isChordInRange,
            shapePolygons,
            boxBounds,
            fretIndex,
          );

      let displayValue = getNoteDisplayInScale(
        noteName,
        rootNote,
        SCALES[scaleName] || [],
        useFlats,
      );
      if (displayFormat === "degrees" && rootNote) {
        const normRoot = ENHARMONICS[rootNote]?.includes("b")
          ? ENHARMONICS[rootNote]
          : rootNote;
        const rootIdx = NOTES.indexOf(
          normRoot.includes("#") ? normRoot : rootNote,
        );
        const noteIdx = NOTES.indexOf(noteName);
        if (rootIdx !== -1 && noteIdx !== -1) {
          displayValue = INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
        }
      } else if (
        fretIndex === 0 &&
        parseNote(_openString)?.noteName === noteName
      ) {
        displayValue = getNoteDisplayInScale(
          noteName,
          rootNote,
          SCALES[scaleName] || [],
          useFlats,
        );
      }

      const isWrapped = wrappedNotes.has(`${stringIndex}-${fretIndex}`);
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
      const applyDimOpacity =
        (shapePolygons.length > 0 &&
          !isInsideAnyPolygon &&
          (noteClass === "note-blue" ||
            noteClass === "chord-tone-outside-scale" ||
            noteClass === "chord-tone-in-scale" ||
            noteClass === "chord-root" ||
            noteClass === "key-tonic")) ||
        (isWrapped && isHighlighted);

      const isHidden = (() => {
        // chord mode: hide all scale-only notes.
        if (noteClass === "scale-only" && hideNonChordNotes) return true;
        // outside mode: only outside chord tones (and outside chord root) visible.
        if (viewMode === "outside" && hasChordOverlay) {
          if (noteClass === "chord-tone-outside-scale") return false;
          if (noteClass === "chord-root" && !isHighlighted) return false;
          return true;
        }
        return false;
      })();

      return [
        {
          stringIndex,
          fretIndex,
          noteName,
          noteClass,
          displayValue,
          applyDimOpacity,
          isHidden,
        },
      ];
    }),
  );

  return (
    <div role="group" aria-label={ariaLabel} className="fretboard-board">
      <div
        className="fretboard-neck"
        style={
          {
            height: `${neckHeight + NECK_BORDER * 2}px`,
            width: `${neckWidthPx + NECK_BORDER * 2}px`,
            "--string-row-px": `${stringRowPx}px`,
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
            {/* Trapezoidal fretboard silhouette — everything inside the tapered
                region is clipped. Strings, frets, inlays, polygons, and note
                circles all live inside this clip. */}
            <clipPath id={svgDefId("fretboard-taper")}>
              <path d={taperPath} />
            </clipPath>
          </defs>

          <g clipPath={svgDefUrl("fretboard-taper")}>
            {/* Wood stack — base gradient, deep horizontal grain, warm ribbon
                highlights, fine pore noise, then the edge vignette. */}
            <rect
              x={0}
              y={0}
              width={neckWidthPx}
              height={neckHeight}
              fill={svgDefUrl("fretboard-wood")}
            />
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
            <rect
              x={0}
              y={0}
              width={neckWidthPx}
              height={neckHeight}
              fill={svgDefUrl("fretboard-vignette")}
            />

            {/* Headstock face — the fret 0 area uses a distinct material (a
                near-black lacquered finish) so it reads as the headstock
                rather than continuing the ebony fretboard grain. Painted
                after the wood stack but before the nut graphic. */}
            {startFret === 0 && (
              <rect
                x={0}
                y={0}
                width={Math.max(0, wireXRel(0) - NUT_WIDTH)}
                height={neckHeight}
                fill="#07050a"
              />
            )}

            {/* Bone nut — sits at wireXRel(0), with the open-string column to
                its LEFT and fret 1 to its RIGHT. Gradient body, bright top
                highlight, dark under-shadow, and per-string slot notches on
                the fret-side face. */}
            {startFret === 0 &&
              (() => {
                const nutRightX = wireXRel(0);
                const nutLeftX = nutRightX - NUT_WIDTH;
                return (
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
                        fill="rgb(12 8 4 / 0.55)"
                      />
                    ))}
                  </g>
                );
              })()}

            {/* Fret wires — each rendered as a single thin rect filled with a
              horizontal silver gradient that reads as a cylindrical crown.
              Loop stops at maxFret so wire 24 is the final rendered wire —
              the post-24 region exists as wood but has no wire at its right 
              boundary. */}
            {(() => {
              const wireStart = startFret === 0 ? 1 : startFret - 1;
              const wires = [];
              const wireThickness = 4;
              for (let wireIdx = wireStart; wireIdx < maxFret; wireIdx++) {
                const x = wireXRel(wireIdx);
                wires.push(
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
              return wires;
            })()}

            {/* Inlay dots — mother-of-pearl radial gradient + drop shadow. Y
              positions are resolved per-fret so inlays track the tapered
              strings rather than floating off centre on the wider end. */}
            {Array.from({ length: totalColumns + 1 }).map((_, idx) => {
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
            })}

            {/* Strings — tapered (narrower at nut, wider at bridge). All strings
              are silver-plated; bass strings (3–5) have a second dashed stroke
              overlaid to suggest the perpendicular winding wraps. */}
            {tuning.map((_openString, stringIndex) => {
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
                    stroke={isBass ? "#c6ccd2" : "#e4e8ee"}
                    style={{
                      strokeWidth: `var(--string-taper-${stringIndex + 1})`,
                    }}
                    strokeLinecap="round"
                    className={`fretboard-string fretboard-string-${stringIndex + 1}`}
                  />
                  {isBass && (
                    <line
                      x1={0}
                      y1={yLeft}
                      x2={neckWidthPx}
                      y2={yRight}
                      stroke="rgb(60 65 72 / 0.55)"
                      style={{
                        strokeWidth: `var(--string-taper-${stringIndex + 1})`,
                      }}
                      strokeLinecap="butt"
                      strokeDasharray="0.6 1.4"
                    />
                  )}
                </g>
              );
            })}

            {/* Shape polygons overlay */}
            {svgPolygons.length > 0 &&
              svgPolygons.map(({ points, color, key }) => (
                <polygon key={key} points={points} fill={color} stroke="none" />
              ))}

            {/* Note circles (outlined-glow) — visual only, aria-hidden SVG */}
            {noteData.map(
              ({
                stringIndex,
                fretIndex,
                noteClass,
                displayValue,
                applyDimOpacity,
                isHidden,
              }) => {
                if (noteClass === "note-inactive") return null;
                const cx = fretCenterX(fretIndex);
                const cy = stringYAt(stringIndex, cx);
                const baseRadius = noteBubblePx / 2;
                const {
                  stroke,
                  filter,
                  fill,
                  textFill,
                  radiusScale,
                  strokeWidth,
                  textOpacity,
                  strokeDasharray,
                } = getNoteVisuals(noteClass, glowFilterUrls);
                const r = baseRadius * radiusScale;
                return (
                  <g
                    key={`note-${stringIndex}-${fretIndex}`}
                    className={clsx(
                      "fretboard-note",
                      noteClass,
                      isHidden && "hidden",
                    )}
                    data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
                    style={{ opacity: applyDimOpacity ? 0.8 : 1 }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      filter={filter !== "none" ? filter : undefined}
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
                          strokeWidth: noteClass === "chord-root" || noteClass === "key-tonic" ? 2.3 : 1.8,
                        }}
                      >
                        {formatAccidental(displayValue)}
                      </text>
                    )}
                  </g>
                );
              },
            )}
          </g>

          {/* Beveled binding strokes — trace the tapered top/bottom edges.
              A faint warm highlight on top and a dark shadow on the bottom
              give the fretboard an extruded, 3D edge. Rendered OUTSIDE the
              clip so they sit crisply on the silhouette. */}
          <path
            d={`M 0 ${taperYLeft} L ${neckWidthPx} 0`}
            stroke="rgb(218 182 138 / 0.22)"
            strokeWidth={0.9}
            fill="none"
          />
          <path
            d={`M 0 ${neckHeight - taperYLeft} L ${neckWidthPx} ${neckHeight}`}
            stroke="rgb(0 0 0 / 0.75)"
            strokeWidth={1}
            fill="none"
          />
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
            ({ stringIndex, fretIndex, noteClass, displayValue, isHidden }) => {
              if (noteClass === "note-inactive") return null;
              const cx = fretCenterX(fretIndex);
              const cy = stringYAt(stringIndex, cx);
              const r = noteBubblePx / 2;
              return (
                <button
                  key={`btn-${stringIndex}-${fretIndex}`}
                  type="button"
                  onClick={
                    onNoteClick && !isHidden
                      ? () =>
                          onNoteClick(
                            stringIndex,
                            fretIndex,
                            fretboardLayout[stringIndex][fretIndex],
                          )
                      : undefined
                  }
                  disabled={!onNoteClick || isHidden}
                  aria-hidden={isHidden || undefined}
                  tabIndex={isHidden ? -1 : undefined}
                  aria-label={`${formatAccidental(displayValue)} on string ${stringIndex + 1}, fret ${fretIndex}`}
                  data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
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
}
