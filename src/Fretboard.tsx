import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { clsx } from "clsx";
import {
  getFretboardNotes,
  getFretNoteWithOctave,
  getNoteFrequency,
  STANDARD_FRET_MARKERS,
  parseNote,
} from "./guitar";
import { NOTES, ENHARMONICS, getNoteDisplayInScale, INTERVAL_NAMES, formatAccidental, SCALES } from "./theory";
import { synth } from "./audio";
import type { ShapePolygon } from "./shapes";
import { FretRangeControl } from "./components/FretRangeControl";
import { StepperControl } from "./components/StepperControl";

const STRING_ROW_PX_DEFAULT = 40;
const ZOOM_MAX_PCT = 300;

interface FretboardProps {
  tuning: string[];
  startFret?: number;
  endFret?: number;
  maxFret?: number;
  highlightNotes: string[];
  rootNote: string;
  displayFormat?: "notes" | "degrees" | "none";
  boxBounds?: { minFret: number; maxFret: number }[];
  chordTones?: string[];
  chordFretSpread?: number;
  onChordFretSpreadChange?: (spread: number) => void;
  hideNonChordNotes?: boolean;
  colorNotes?: string[];
  shapePolygons?: ShapePolygon[];
  shapeLabels?: "modal" | "caged" | "none";
  wrappedNotes?: Set<string>;
  fretZoom?: number;
  onZoomChange?: (zoom: number) => void;
  onFretStartChange?: (fret: number) => void;
  onFretEndChange?: (fret: number) => void;
  onFretClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
  useFlats?: boolean;
  scaleName?: string;
  stringRowPx?: number;
}

export function Fretboard({
  tuning,
  startFret = 0,
  endFret = 24,
  maxFret = 24,
  highlightNotes,
  rootNote,
  displayFormat = "notes",
  boxBounds = [],
  chordTones = [],
  chordFretSpread = 0,
  onChordFretSpreadChange,
  hideNonChordNotes = false,
  colorNotes = [],
  shapePolygons = [],
  shapeLabels = "none",
  wrappedNotes = new Set<string>(),
  fretZoom = 100,
  onZoomChange,
  onFretStartChange,
  onFretEndChange,
  onFretClick,
  useFlats = false,
  scaleName = "",
  stringRowPx = STRING_ROW_PX_DEFAULT,
}: FretboardProps) {
  const fretboardLayout = getFretboardNotes(tuning, Math.max(endFret, maxFret));
  const fretCount = endFret - startFret;

  // Track viewport width to detect mobile
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isMobile = viewportWidth < 768;

  // Measure container width to compute auto-fill zoom (desktop + tablet)
  const [containerWidth, setContainerWidth] = useState(0);
  const totalColumns = fretCount + 1; // includes fret 0
  // Minimum fret width prevents squished fretboards on tablet when the container is
  // narrower than the full viewport (e.g., iPad with settings column visible).
  // When autoFitZoom falls below MIN_FRET_WIDTH the SVG overflows its container,
  // and .fretboard-wrapper's overflow-x: auto enables horizontal scroll.
  const MIN_FRET_WIDTH = 49;
  const autoFitZoom = Math.max(
    MIN_FRET_WIDTH,
    containerWidth > 0 && totalColumns > 0
      ? Math.floor(containerWidth / totalColumns)
      : 30
  );
  // fretZoom is a percentage: 100 = auto-fit, 110 = 10% larger, etc.
  const desktopZoom = fretZoom <= 100
    ? autoFitZoom
    : Math.round(autoFitZoom * fretZoom / 100);
  // On mobile phones (<768px), override zoom so ~7 frets fill the viewport width
  // Tablets (>=768px) use container-aware desktopZoom since they may be in a narrower column
  const isLandscape = window.innerWidth > window.innerHeight;
  const mobileFretDivisor = isLandscape ? 10 : 7;
  const baseMobileZoom = Math.floor(viewportWidth / mobileFretDivisor);
  const mobileZoom = fretZoom <= 100
    ? baseMobileZoom
    : Math.round(baseMobileZoom * fretZoom / 100);
  const effectiveZoom = isMobile ? mobileZoom : desktopZoom;

  // Drag-to-scroll — deferred pointer capture so taps reach note-bubbles
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const pendingPointerId = useRef<number | null>(null);
  const pendingTarget = useRef<Element | null>(null);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const dragDistance = useRef(0);

  const [hasOverflow, setHasOverflow] = useState(false);

  // Measure container width synchronously before paint to avoid flash on load
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recheck overflow whenever neck width or container width changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setHasOverflow(el.scrollWidth > el.clientWidth + 1);
  }, [effectiveZoom, fretCount, containerWidth]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasOverflow) return;
    if (!scrollRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    pendingPointerId.current = e.pointerId;
    pendingTarget.current = e.currentTarget;
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
    dragDistance.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pendingPointerId.current === null || !scrollRef.current) return;
    dragDistance.current += Math.abs(e.movementX);
    // Only start capturing once we've detected real drag motion
    if (!isDraggingRef.current && dragDistance.current > 3) {
      isDraggingRef.current = true;
      setIsDragging(true);
      pendingTarget.current?.setPointerCapture(pendingPointerId.current);
    }
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    pendingPointerId.current = null;
    pendingTarget.current = null;
  };

  const scrollToFret = (fret: number) => {
    if (!scrollRef.current) return;
    const offset = (fret - startFret) * effectiveZoom;
    scrollRef.current.scrollTo({ left: Math.max(0, offset - 20), behavior: "smooth" });
  };

  const handleFretClick = (stringIndex: number, fretIndex: number, noteName: string) => {
    if (dragDistance.current > 5) return;
    const fretNoteWithOctave = getFretNoteWithOctave(tuning[stringIndex], fretIndex);
    const frequency = getNoteFrequency(fretNoteWithOctave);
    synth.playNote(frequency);
    if (onFretClick) onFretClick(stringIndex, fretIndex, noteName);
  };

  const hasChordOverlay = chordTones.length > 0;

  const NECK_BORDER = 4; // matches border width in CSS
  const neckWidth = totalColumns * effectiveZoom;
  // Half a row padding above first string and below last string
  const neckHeight = tuning.length * stringRowPx;

  // Scale note bubble size and font proportionally with stringRowPx
  const noteBubblePx = Math.round(stringRowPx * 0.8); // diameter = 2 * radius (0.4 * stringRowPx)
  const noteFontPx = Math.round(stringRowPx * 0.4);

  // Uniform fret X: every fret (including 0) is the same width
  const fretToX = (fret: number) => (fret - startFret + 0.5) * effectiveZoom;

  // String center Y: centers at 20, 60, 100, 140, 180, 220 for 6 strings
  const stringCenterY = (s: number) => stringRowPx / 2 + s * stringRowPx;

  // Build SVG polygon points from shape vertex data
  const svgPolygons = shapePolygons.map((poly, polyIdx) => {
    if (poly.vertices.length === 0) {
      return { points: '', color: poly.color, key: `${poly.shape}-${polyIdx}`, poly, centerX: 0 };
    }

    // Convert vertices to pixel coordinates, adding top/bottom caps
    const pixelPoints: string[] = [];

    // The vertices are already ordered: left edge top→bottom, then right edge bottom→top
    // We need to insert vertical caps at the top and bottom transitions
    const verts = poly.vertices;
    const halfVerts = verts.length / 2; // left edge: first half, right edge: second half

    // Clamped fret boundaries that were used when collecting notes
    const clampedMin = Math.max(0, poly.intendedMin);
    const clampedMax = Math.min(maxFret, poly.intendedMax);

    // Resolve the fret value for a vertex, extending it beyond the fretboard edge when
    // the shape was truncated. A left-edge vertex sitting at clampedMin was clamped from
    // intendedMin; replace it with the unclamped value so the polygon continues off-screen.
    // The fretboard-neck's overflow:hidden clips the excess visually.
    const resolveLeftFret = (fret: number) =>
      fret === clampedMin && poly.intendedMin < clampedMin ? poly.intendedMin : fret;
    const resolveRightFret = (fret: number) =>
      fret === clampedMax && poly.intendedMax > clampedMax ? poly.intendedMax : fret;

    // Left edge: vertices 0..halfVerts-1 (s0→s5)
    // Insert top cap before first left vertex
    const firstLeft = verts[0];
    pixelPoints.push(`${fretToX(resolveLeftFret(firstLeft.fret))},0`);

    for (let i = 0; i < halfVerts; i++) {
      pixelPoints.push(`${fretToX(resolveLeftFret(verts[i].fret))},${stringCenterY(verts[i].string)}`);
    }

    // Insert bottom cap after last left vertex (s5)
    const lastLeft = verts[halfVerts - 1];
    pixelPoints.push(`${fretToX(resolveLeftFret(lastLeft.fret))},${neckHeight}`);

    // Right edge: vertices halfVerts..end (s5→s0)
    const firstRight = verts[halfVerts];
    pixelPoints.push(`${fretToX(resolveRightFret(firstRight.fret))},${neckHeight}`);

    for (let i = halfVerts; i < verts.length; i++) {
      pixelPoints.push(`${fretToX(resolveRightFret(verts[i].fret))},${stringCenterY(verts[i].string)}`);
    }

    // Insert top cap after last right vertex (s0)
    const lastRight = verts[verts.length - 1];
    pixelPoints.push(`${fretToX(resolveRightFret(lastRight.fret))},0`);

    const points = pixelPoints.join(' ');

    // Center label on the low E string (string 5) span midpoint.
    // verts[halfVerts-1] is the last left-edge vertex (s5 for full polygons),
    // verts[halfVerts] is the first right-edge vertex (s5 for full polygons).
    const s5Left = verts[halfVerts - 1].fret;
    const s5Right = verts[halfVerts].fret;
    const s5Center = (s5Left + s5Right) / 2;
    // Clamp to visible fretboard so the label stays on screen
    const clampedCenter = Math.max(startFret, Math.min(endFret, s5Center));
    const centerX = fretToX(clampedCenter);

    return { points, color: poly.color, key: `${poly.shape}-${polyIdx}`, poly, centerX };
  });


  return (
    <div className="fretboard-outer">
      {/* Toolbar */}
      <div className="fretboard-toolbar">
        <div className="viewport-jumps">
          <span className="section-label">Go to</span>
          {[["Open", 0], ["Mid", 5], ["High", 12]] .map(([label, fret]) => (
            <button key={label as string} className="toolbar-btn"
              disabled={(fret as number) < startFret || (fret as number) > endFret}
              onClick={() => scrollToFret(fret as number)}>
              {label}
            </button>
          ))}
        </div>
        <div className="fret-range-controls">
          <span className="section-label">Frets</span>
          <FretRangeControl
            startFret={startFret}
            endFret={endFret}
            onStartChange={onFretStartChange ?? (() => {})}
            onEndChange={onFretEndChange ?? (() => {})}
            maxFret={maxFret}
            layout="toolbar"
          />
        </div>
        <StepperControl
          label="Zoom"
          value={fretZoom}
          onChange={onZoomChange ?? (() => {})}
          min={100}
          max={ZOOM_MAX_PCT}
          step={10}
          formatValue={(z) => z <= 100 ? 'Auto' : `${z}%`}
          buttonVariant="toolbar"
        />
        {hasChordOverlay && shapePolygons.length > 0 && (
          <StepperControl
            label="Chord Spread"
            value={chordFretSpread}
            onChange={onChordFretSpreadChange ?? (() => {})}
            min={0}
            max={4}
            step={1}
            buttonVariant="toolbar"
          />
        )}
      </div>

      {/* Scrollable fretboard */}
      <div
        className="fretboard-wrapper hide-scrollbar"
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: hasOverflow ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        {/* Fret numbers above neck */}
        <div className="fret-numbers-row" style={{ width: `${neckWidth + NECK_BORDER * 2}px`, paddingLeft: `${NECK_BORDER}px` }}>
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
            width: `${neckWidth + NECK_BORDER * 2}px`,
          }}
        >
          {/* Fret backgrounds/markers */}
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

          {/* CAGED shape background polygons */}
          {svgPolygons.length > 0 && (
            <svg
              className="shape-polygons-overlay"
              width={neckWidth}
              height={neckHeight}
              style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}
            >
              {svgPolygons.map(({ points, color, key }) => (
                <polygon key={key} points={points} fill={color} stroke="none" />
              ))}
            </svg>
          )}

          {/* Strings and Notes */}
          <div className="strings-container">
            {tuning.map((openString, stringIndex) => (
              <div key={`string-${stringIndex}`} className="string-row" style={stringRowPx !== STRING_ROW_PX_DEFAULT ? { height: `${stringRowPx}px` } : undefined}>
                <div className="string-line"
                  style={{ height: `${(stringIndex + 1) * 0.4 + 1.5}px` }} />
                <div className="string-notes">
                  {Array.from({ length: totalColumns }).map((_, idx) => {
                    const fretIndex = startFret + idx;
                    const noteName = fretboardLayout[stringIndex][fretIndex];

                    const isHighlighted =
                      highlightNotes.includes(noteName) ||
                      highlightNotes.includes(`${stringIndex}-${fretIndex}`);
                    const isChordTone = hasChordOverlay && chordTones.includes(noteName);
                    const isRoot =
                      noteName === rootNote ||
                      ENHARMONICS[noteName] === rootNote ||
                      ENHARMONICS[rootNote] === noteName;
                    const isColorNote = colorNotes.length > 0 && colorNotes.some(cn =>
                      noteName === cn ||
                      ENHARMONICS[noteName] === cn ||
                      ENHARMONICS[cn] === noteName
                    );

                    // 3-tier visual logic
                    // When CAGED shapes + chord overlay are active, filter chord notes by fret spread
                    const isChordInRange = !hasChordOverlay || !shapePolygons.length ||
                      boxBounds.some(b => fretIndex >= b.minFret - chordFretSpread && fretIndex <= b.maxFret + chordFretSpread);

                    let noteClass: string;
                    if (isRoot && (isHighlighted || (isChordTone && isChordInRange))) {
                      noteClass = "root-active";
                    } else if (isColorNote && isHighlighted) {
                      noteClass = "note-blue";
                    } else if (isHighlighted && isChordTone) {
                      noteClass = "chord-tone";
                    } else if (isHighlighted && !hasChordOverlay) {
                      noteClass = "note-active";
                    } else if (isHighlighted && hasChordOverlay) {
                      // Scale-only note when chord overlay active; may be hidden by hideNonChordNotes
                      noteClass = "note-scale-only";
                    } else if (!isHighlighted && isChordTone && isChordInRange) {
                      noteClass = "chord-outside";
                    } else if (isColorNote && shapePolygons.length > 0 &&
                               boxBounds.some(b => fretIndex >= b.minFret - 1 && fretIndex <= b.maxFret + 1)) {
                      // Blue note within 1 fret of a CAGED shape — shown at reduced opacity
                      noteClass = "note-blue";
                    } else {
                      noteClass = "note-inactive";
                    }

                    let displayValue = getNoteDisplayInScale(noteName, rootNote, SCALES[scaleName] || [], useFlats);
                    if (displayFormat === "degrees" && rootNote) {
                      const normRoot = ENHARMONICS[rootNote]?.includes("b") ? ENHARMONICS[rootNote] : rootNote;
                      const rootIdx = NOTES.indexOf(normRoot.includes("#") ? normRoot : rootNote);
                      const noteIdx = NOTES.indexOf(noteName);
                      if (rootIdx !== -1 && noteIdx !== -1) {
                        displayValue = INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
                      }
                    } else if (fretIndex === 0 && parseNote(openString).noteName === noteName) {
                      displayValue = getNoteDisplayInScale(noteName, rootNote, SCALES[scaleName] || [], useFlats);
                    }

                    const isWrapped = wrappedNotes.has(`${stringIndex}-${fretIndex}`);

                    const isInsideAnyPolygon = shapePolygons.some(poly => {
                      const leftFret = poly.vertices[stringIndex]?.fret;
                      const rightFret = poly.vertices[poly.vertices.length - 1 - stringIndex]?.fret;
                      return leftFret !== undefined && rightFret !== undefined &&
                        fretIndex >= leftFret && fretIndex <= rightFret;
                    });

                    const applyDimOpacity =
                      (shapePolygons.length > 0 && !isInsideAnyPolygon && (
                        noteClass === "note-blue" ||
                        noteClass === "chord-outside" ||
                        noteClass === "chord-tone" ||
                        noteClass === "root-active"
                      )) ||
                      (isWrapped && isHighlighted);

                    return (
                      <div
                        key={`note-${stringIndex}-${fretIndex}`}
                        className="note-cell"
                        style={{ width: `${effectiveZoom}px` }}
                      >
                        <div
                          onClick={() => handleFretClick(stringIndex, fretIndex, noteName)}
                          className={clsx(
                            "note-bubble",
                            noteClass,
                            noteClass === "note-scale-only" && hideNonChordNotes && "hidden"
                          )}
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

        {/* Shape labels below fretboard */}
        {shapeLabels !== "none" && svgPolygons.length > 0 && (
          <div className="shape-labels-row" style={{ width: `${neckWidth + NECK_BORDER * 2}px` }}>
            {svgPolygons.map(({ key, poly, centerX }) => {
              if (poly.truncated) return null;
              const text = shapeLabels === "modal" ? (poly.modalLabel ?? poly.cagedLabel) : poly.cagedLabel;
              return (
                <span
                  key={key}
                  className="shape-label"
                  style={{ left: `${centerX + NECK_BORDER}px` }}
                >
                  {text}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

