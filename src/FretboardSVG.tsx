import { clsx } from "clsx";
import { NOTES, ENHARMONICS, getNoteDisplayInScale, INTERVAL_NAMES, formatAccidental, SCALES } from "./theory";
import { STANDARD_FRET_MARKERS, parseNote } from "./guitar";
import type { ShapePolygon } from "./shapes";

const STRING_ROW_PX_DEFAULT = 40;
const NECK_BORDER = 4;

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
  shapeLabels?: "modal" | "caged" | "none";
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

  const fretToX = (fret: number) => (fret - startFret + 0.5) * effectiveZoom;
  const stringCenterY = (s: number) => stringRowPx / 2 + s * stringRowPx;

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

  return (
    <>
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

      <div
        className="fretboard-neck"
        style={{
          height: `${neckHeight + NECK_BORDER * 2}px`,
          width: `${neckWidthPx + NECK_BORDER * 2}px`,
          "--string-row-px": `${stringRowPx}px`,
        } as React.CSSProperties}
      >
        <div className="fret-backgrounds">
          {Array.from({ length: totalColumns }).map((_, idx) => {
            const fretIndex = startFret + idx;
            return (
              <div
                key={`fret-bg-${fretIndex}`}
                className={clsx("fret-column", fretIndex === 0 ? "fret-zero" : "fret-standard")}
                style={{ width: `${effectiveZoom}px` }}
              >
                {STANDARD_FRET_MARKERS.includes(fretIndex) && (
                  <div className="fret-marker-container">
                    {fretIndex === 12 || fretIndex === 24 ? (
                      <div className="marker-double">
                        <div className="marker-dot" />
                        <div className="marker-dot" />
                      </div>
                    ) : (
                      <div className="marker-dot" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {svgPolygons.length > 0 && (
          <svg
            className="shape-polygons-overlay"
            width={neckWidthPx}
            height={neckHeight}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 1 }}
          >
            {svgPolygons.map(({ points, color, key }) => (
              <polygon key={key} points={points} fill={color} stroke="none" />
            ))}
          </svg>
        )}

        <div className="strings-container">
          {tuning.map((openString, stringIndex) => (
            <div
              key={`string-${stringIndex}`}
              className="string-row"
              style={stringRowPx !== STRING_ROW_PX_DEFAULT ? { height: `${stringRowPx}px` } : undefined}
            >
              <div className="string-line" style={{ height: `${(stringIndex + 1) * 0.4 + 1.5}px` }} />
              <div className="string-notes">
                {Array.from({ length: totalColumns }).map((_, idx) => {
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
                  } else if (fretIndex === 0 && parseNote(openString)?.noteName === noteName) {
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

                  return (
                    <div key={`note-${stringIndex}-${fretIndex}`} className="note-cell" style={{ width: `${effectiveZoom}px` }}>
                      <div
                        onClick={() => onNoteClick?.(stringIndex, fretIndex, noteName)}
                        className={clsx("note-bubble", noteClass,
                          noteClass === "note-scale-only" && hideNonChordNotes && "hidden")}
                        style={{
                          width: `${noteBubblePx}px`,
                          height: `${noteBubblePx}px`,
                          fontSize: `${noteFontPx}px`,
                          ...(applyDimOpacity ? { opacity: 0.8 } : {}),
                        }}
                      >
                        {displayFormat !== "none" && (
                          <span className="note-main-label">{formatAccidental(displayValue)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {shapeLabels !== "none" && svgPolygons.length > 0 && (
        <div className="shape-labels-row" style={{ width: `${neckWidthPx + NECK_BORDER * 2}px` }}>
          {svgPolygons.map(({ key, poly, centerX }) => {
            if (poly.truncated) return null;
            const text = shapeLabels === "modal" ? (poly.modalLabel ?? poly.cagedLabel) : poly.cagedLabel;
            return (
              <span key={key} className="shape-label" style={{ left: `${centerX + NECK_BORDER}px` }}>
                {text}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
