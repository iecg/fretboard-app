import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { clsx } from "clsx";
import { useAtomValue } from "jotai";
import {
  getFretboardNotes,
  getFretNoteWithOctave,
  getNoteFrequency,
} from "./guitar";
import { synth } from "./audio";
import type { ShapePolygon } from "./shapes";
import { fretZoomAtom, fretStartAtom, fretEndAtom } from "./store/atoms";
import { FretboardSVG } from "./FretboardSVG";
import type { ViewMode } from "./theory";
import { 
  STRING_ROW_PX_DEFAULT, 
  MAX_FRET, 
  NOTE_BUBBLE_RATIO, 
  MIN_FRET_WIDTH_BASE, 
  MIN_FRET_WIDTH_OVERFLOW_BUFFER 
} from "./constants";

interface FretboardProps {
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
  onFretClick?: (
    stringIndex: number,
    fretIndex: number,
    noteName: string,
  ) => void;
  useFlats?: boolean;
  scaleName?: string;
  stringRowPx?: number;
  autoCenterTarget?: number;
  recenterKey?: number;
}

export function Fretboard({
  tuning,
  maxFret = MAX_FRET,
  highlightNotes,
  rootNote,
  displayFormat = "notes",
  boxBounds = [],
  chordTones = [],
  chordRoot,
  chordFretSpread = 0,
  hideNonChordNotes = false,
  viewMode = "compare",
  autoCenterTarget,
  recenterKey,
  colorNotes = [],
  shapePolygons = [],
  wrappedNotes = new Set<string>(),
  hiddenNotes,
  onFretClick,
  useFlats = false,
  scaleName = "",
  stringRowPx = STRING_ROW_PX_DEFAULT,
}: FretboardProps) {
  const fretZoom = useAtomValue(fretZoomAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);
  const fretboardLayout = getFretboardNotes(tuning, Math.max(endFret, maxFret));

  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const totalColumns = endFret - startFret;
  const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
  const MIN_FRET_WIDTH = Math.max(MIN_FRET_WIDTH_BASE, noteBubblePx + MIN_FRET_WIDTH_OVERFLOW_BUFFER);
  
  // Use a sensible default zoom (40) if width is not yet measured to prevent massive jumps
  const autoFitZoom = Math.max(
    MIN_FRET_WIDTH,
    containerWidth !== null && containerWidth > 0 && totalColumns > 0 
      ? containerWidth / totalColumns 
      : 40,
  );
  const desktopZoom =
    fretZoom <= 100 ? autoFitZoom : (autoFitZoom * fretZoom) / 100;
  const effectiveZoom = desktopZoom;

  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const pendingPointerId = useRef<number | null>(null);
  const pendingTarget = useRef<Element | null>(null);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const dragDistance = useRef(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Synchronous initial measurement
    setContainerWidth(el.clientWidth);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Use contentRect for more accurate width without padding/borders
        setContainerWidth(entry.contentRect.width);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || containerWidth === null) return;
    setHasOverflow(el.scrollWidth > el.clientWidth + 1);
  }, [effectiveZoom, totalColumns, containerWidth]);

  const effectiveZoomRef = useRef(effectiveZoom);
  useEffect(() => {
    effectiveZoomRef.current = effectiveZoom;
  }, [effectiveZoom]);

  useEffect(() => {
    if (autoCenterTarget === undefined) return;
    const el = scrollRef.current;
    if (!el) return;
    const zoom = effectiveZoomRef.current;
    const targetOffset = (autoCenterTarget - startFret) * zoom;
    const containerW = el.clientWidth;
    const centerOffset = targetOffset - containerW / 2 + zoom / 2;
    el.scrollTo({ left: Math.max(0, centerOffset), behavior: "smooth" });
  }, [autoCenterTarget, recenterKey, startFret]);

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

  const handleFretClick = (
    stringIndex: number,
    fretIndex: number,
    noteName: string,
  ) => {
    if (dragDistance.current > 5) return;
    const fretNoteWithOctave = getFretNoteWithOctave(
      tuning[stringIndex],
      fretIndex,
    );
    const frequency = getNoteFrequency(fretNoteWithOctave);
    synth.playNote(frequency);
    if (onFretClick) onFretClick(stringIndex, fretIndex, noteName);
  };

  const neckWidth = totalColumns * effectiveZoom;

  return (
    <div 
      className="fretboard-outer" 
      data-testid="fretboard-main"
      style={{
        // Reserve vertical space: tuning rows + approx 24px for fret numbers
        minHeight: `${tuning.length * stringRowPx + 24}px`
      }}
    >
      <div
        className={clsx("fretboard-wrapper", "hide-scrollbar")}
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          cursor: hasOverflow ? (isDragging ? "grabbing" : "grab") : "default",
          // Hide until measured to prevent the initial "jump" from being painted
          visibility: containerWidth === null ? "hidden" : "visible",
        }}
      >
        <FretboardSVG
          effectiveZoom={effectiveZoom}
          neckWidthPx={neckWidth}
          startFret={startFret}
          endFret={endFret}
          stringRowPx={stringRowPx}
          fretboardLayout={fretboardLayout}
          tuning={tuning}
          maxFret={maxFret}
          highlightNotes={highlightNotes}
          rootNote={rootNote}
          displayFormat={displayFormat}
          boxBounds={boxBounds}
          chordTones={chordTones}
          chordRoot={chordRoot}
          chordFretSpread={chordFretSpread}
          hideNonChordNotes={hideNonChordNotes}
          viewMode={viewMode}
          colorNotes={colorNotes}
          shapePolygons={shapePolygons}
          wrappedNotes={wrappedNotes}
          hiddenNotes={hiddenNotes}
          useFlats={useFlats}
          scaleName={scaleName}
          onNoteClick={handleFretClick}
        />
      </div>
    </div>
  );
}
