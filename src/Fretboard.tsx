import { useState, useRef } from "react";
import { clsx } from "clsx";
import {
  getFretboardNotes,
  getFretNoteWithOctave,
  getNoteFrequency,
  STANDARD_FRET_MARKERS,
  parseNote,
} from "./guitar";
import { NOTES, ENHARMONICS, getNoteDisplay } from "./theory";
import { synth } from "./audio";
import type { CellColor } from "./shapes";

const INTERVAL_NAMES = [
  "1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7",
];

const STRING_ROW_PX = 40;
const FRET_COL_MIN_PX = 45;
const ZOOM_MIN = 30;
const ZOOM_MAX = 80;
const ZOOM_STEP = 5;

interface FretboardProps {
  tuning: string[];
  startFret?: number;
  endFret?: number;
  highlightNotes: string[];
  rootNote: string;
  displayFormat?: "notes" | "degrees";
  boxBounds?: { minFret: number; maxFret: number }[];
  chordTones?: string[];
  hideNonChordNotes?: boolean;
  cellColorMap?: Record<string, CellColor>;
  fretZoom?: number;
  onZoomChange?: (zoom: number) => void;
  onFretClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
}

export function Fretboard({
  tuning,
  startFret = 0,
  endFret = 22,
  highlightNotes,
  rootNote,
  displayFormat = "notes",
  boxBounds: _boxBounds = [],
  chordTones = [],
  hideNonChordNotes = false,
  cellColorMap = {},
  fretZoom = FRET_COL_MIN_PX,
  onZoomChange,
  onFretClick,
}: FretboardProps) {
  const fretboardLayout = getFretboardNotes(tuning, Math.max(endFret, 24));
  const fretCount = endFret - startFret;

  // Drag-to-scroll — deferred pointer capture so taps reach note-bubbles
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const pendingPointerId = useRef<number | null>(null);
  const pendingTarget = useRef<Element | null>(null);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const dragDistance = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = false;
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
    pendingPointerId.current = null;
    pendingTarget.current = null;
  };

  const scrollToFret = (fret: number) => {
    if (!scrollRef.current) return;
    // fret 0 column is 4rem wide; subsequent frets use fretZoom px each
    const fretZeroWidth = 64; // 4rem in px (matches .fret-zero-cell width)
    const offset = fret === 0 ? 0 : fretZeroWidth + (fret - 1) * fretZoom;
    scrollRef.current.scrollTo({ left: offset - 20, behavior: "smooth" });
  };

  const handleFretClick = (stringIndex: number, fretIndex: number, noteName: string) => {
    if (dragDistance.current > 5) return;
    const fretNoteWithOctave = getFretNoteWithOctave(tuning[stringIndex], fretIndex);
    const frequency = getNoteFrequency(fretNoteWithOctave);
    synth.playNote(frequency);
    if (onFretClick) onFretClick(stringIndex, fretIndex, noteName);
  };

  const hasChordOverlay = chordTones.length > 0;

  return (
    <div className="fretboard-outer">
      {/* Toolbar */}
      <div className="fretboard-toolbar">
        <div className="viewport-jumps">
          <span className="section-label">Jump</span>
          {[["Open", 0], ["Mid", 5], ["High", 12]] .map(([label, fret]) => (
            <button key={label as string} className="toolbar-btn"
              onClick={() => scrollToFret(fret as number)}>
              {label}
            </button>
          ))}
        </div>
        <div className="zoom-controls">
          <span className="section-label">Zoom</span>
          <button className="toolbar-btn"
            onClick={() => onZoomChange?.(Math.max(ZOOM_MIN, fretZoom - ZOOM_STEP))}
            disabled={fretZoom <= ZOOM_MIN}>−</button>
          <button className="toolbar-btn"
            onClick={() => onZoomChange?.(Math.min(ZOOM_MAX, fretZoom + ZOOM_STEP))}
            disabled={fretZoom >= ZOOM_MAX}>+</button>
        </div>
      </div>

      {/* Scrollable fretboard */}
      <div
        className="fretboard-wrapper hide-scrollbar"
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: isDraggingRef.current ? "grabbing" : "grab" }}
      >
        <div
          className="fretboard-neck"
          style={{
            height: `${tuning.length * STRING_ROW_PX + 20}px`,
            minWidth: `${64 + fretCount * fretZoom}px`,
          }}
        >
          {/* Fret backgrounds/markers */}
          <div className="fret-backgrounds">
            {Array.from({ length: fretCount + 1 }).map((_, idx) => {
              const fretIndex = startFret + idx;
              return (
                <div
                  key={`fret-bg-${fretIndex}`}
                  className={clsx("fret-column", fretIndex === 0 ? "fret-zero" : "fret-standard")}
                  style={fretIndex > 0 ? { width: `${fretZoom}px` } : undefined}
                >
                  <span className="fret-number">{fretIndex}</span>
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

          {/* Strings and Notes */}
          <div className="strings-container">
            {tuning.map((openString, stringIndex) => (
              <div key={`string-${stringIndex}`} className="string-row">
                <div className="string-line"
                  style={{ height: `${(tuning.length - stringIndex) * 0.4 + 1.5}px` }} />
                <div className="string-notes">
                  {Array.from({ length: fretCount + 1 }).map((_, idx) => {
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

                    // 3-tier visual logic
                    let noteClass: string;
                    if (isRoot && (isHighlighted || isChordTone)) {
                      noteClass = "root-active";
                    } else if (isHighlighted && isChordTone) {
                      noteClass = "chord-tone";
                    } else if (isHighlighted && !hasChordOverlay) {
                      noteClass = "note-active";
                    } else if (isHighlighted && hasChordOverlay) {
                      // Scale-only note when chord overlay active; may be hidden by hideNonChordNotes
                      noteClass = "note-scale-only";
                    } else if (!isHighlighted && isChordTone) {
                      noteClass = "chord-outside";
                    } else {
                      noteClass = "note-inactive";
                    }

                    let displayValue = getNoteDisplay(noteName, rootNote);
                    if (displayFormat === "degrees" && rootNote) {
                      const normRoot = ENHARMONICS[rootNote]?.includes("b") ? ENHARMONICS[rootNote] : rootNote;
                      const rootIdx = NOTES.indexOf(normRoot.includes("#") ? normRoot : rootNote);
                      const noteIdx = NOTES.indexOf(noteName);
                      if (rootIdx !== -1 && noteIdx !== -1) {
                        displayValue = INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
                      }
                    } else if (fretIndex === 0 && parseNote(openString).noteName === noteName) {
                      displayValue = getNoteDisplay(noteName, rootNote);
                    }

                    // Build cell background style from CellColor
                    const cellColor = cellColorMap[`${stringIndex}-${fretIndex}`];
                    let cellStyle: React.CSSProperties | undefined;
                    if (cellColor) {
                      if (cellColor.splitColor) {
                        cellStyle = { background: `linear-gradient(to right, ${cellColor.splitColor} 50%, ${cellColor.color} 50%)` };
                      } else if (cellColor.isLeftEdge && cellColor.isRightEdge) {
                        cellStyle = { background: `linear-gradient(to right, transparent 25%, ${cellColor.color} 25%, ${cellColor.color} 75%, transparent 75%)` };
                      } else if (cellColor.isLeftEdge) {
                        cellStyle = { background: `linear-gradient(to right, transparent 50%, ${cellColor.color} 50%)` };
                      } else if (cellColor.isRightEdge) {
                        cellStyle = { background: `linear-gradient(to right, ${cellColor.color} 50%, transparent 50%)` };
                      } else {
                        cellStyle = { backgroundColor: cellColor.color };
                      }
                    }

                    return (
                      <div
                        key={`note-${stringIndex}-${fretIndex}`}
                        className={clsx("note-cell", fretIndex === 0 ? "fret-zero-cell" : "fret-standard-cell")}
                        style={fretIndex > 0
                          ? { ...cellStyle, width: `${fretZoom}px` }
                          : cellStyle}
                      >
                        <div
                          onClick={() => handleFretClick(stringIndex, fretIndex, noteName)}
                          className={clsx(
                            "note-bubble",
                            noteClass,
                            noteClass === "note-scale-only" && hideNonChordNotes && "hidden"
                          )}
                        >
                          {displayValue}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

