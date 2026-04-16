import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { clsx } from "clsx";
import { useAtomValue } from "jotai";
import { getFretboardNotes, getFretNoteWithOctave, getNoteFrequency } from "./guitar";
import { synth } from "./audio";
import type { ShapePolygon } from "./shapes";
import { fretZoomAtom, fretStartAtom, fretEndAtom } from "./store/atoms";
import { FretboardSVG } from "./FretboardSVG";

const STRING_ROW_PX_DEFAULT = 40;

interface FretboardInteractiveProps {
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
  onFretClick?: (stringIndex: number, fretIndex: number, noteName: string) => void;
  useFlats?: boolean;
  scaleName?: string;
  stringRowPx?: number;
  autoCenterTarget?: number;
  recenterKey?: number;
}

export function FretboardInteractive({
  tuning,
  maxFret = 24,
  highlightNotes,
  rootNote,
  displayFormat = "notes",
  boxBounds = [],
  chordTones = [],
  chordFretSpread = 0,
  hideNonChordNotes = false,
  autoCenterTarget,
  recenterKey,
  colorNotes = [],
  shapePolygons = [],
  shapeLabels = "none",
  wrappedNotes = new Set<string>(),
  onFretClick,
  useFlats = false,
  scaleName = "",
  stringRowPx = STRING_ROW_PX_DEFAULT,
}: FretboardInteractiveProps) {
  const fretZoom = useAtomValue(fretZoomAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);
  const fretboardLayout = getFretboardNotes(tuning, Math.max(endFret, maxFret));
  const fretCount = endFret - startFret;

  const [containerWidth, setContainerWidth] = useState(0);
  const totalColumns = fretCount + 1;
  const noteBubblePx = Math.round(stringRowPx * 0.8);
  const MIN_FRET_WIDTH = Math.max(49, noteBubblePx + 17);
  const autoFitZoom = Math.max(
    MIN_FRET_WIDTH,
    containerWidth > 0 && totalColumns > 0
      ? Math.floor(containerWidth / totalColumns)
      : 30
  );
  const desktopZoom = fretZoom <= 100
    ? autoFitZoom
    : Math.round((autoFitZoom * fretZoom) / 100);
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
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setHasOverflow(el.scrollWidth > el.clientWidth + 1);
  }, [effectiveZoom, fretCount, containerWidth]);

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

  const handleFretClick = (stringIndex: number, fretIndex: number, noteName: string) => {
    if (dragDistance.current > 5) return;
    const fretNoteWithOctave = getFretNoteWithOctave(tuning[stringIndex], fretIndex);
    const frequency = getNoteFrequency(fretNoteWithOctave);
    synth.playNote(frequency);
    if (onFretClick) onFretClick(stringIndex, fretIndex, noteName);
  };

  const neckWidth = totalColumns * effectiveZoom;

  return (
    <div className="fretboard-outer">
      <div
        className={clsx("fretboard-wrapper", "hide-scrollbar")}
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: hasOverflow ? (isDragging ? "grabbing" : "grab") : "default" }}
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
          chordFretSpread={chordFretSpread}
          hideNonChordNotes={hideNonChordNotes}
          colorNotes={colorNotes}
          shapePolygons={shapePolygons}
          shapeLabels={shapeLabels}
          wrappedNotes={wrappedNotes}
          useFlats={useFlats}
          scaleName={scaleName}
          onNoteClick={handleFretClick}
        />
      </div>
    </div>
  );
}
