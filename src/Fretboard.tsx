import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { clsx } from "clsx";
import { useAtomValue } from "jotai";
import {
  getFretboardNotes,
  getFretNoteWithOctave,
  getNoteFrequency,
} from "./guitar";
import { synth } from "./audio";
import { fretZoomAtom } from "./store/atoms";
import { FretboardSVG } from "./FretboardSVG";
import { useFretboardState } from "./hooks/useFretboardState";
import { 
  STRING_ROW_PX_DEFAULT, 
  MAX_FRET, 
  NOTE_BUBBLE_RATIO, 
  MIN_FRET_WIDTH_BASE, 
  MIN_FRET_WIDTH_OVERFLOW_BUFFER 
} from "./constants";
import type { ViewMode } from "./theory";
import type { ShapePolygon } from "./shapes";

interface FretboardProps {
  tuning?: string[];
  maxFret?: number;
  highlightNotes?: string[];
  rootNote?: string;
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
  id?: string;
}

export function Fretboard(props: FretboardProps) {
  const state = useFretboardState();
  const fretZoom = useAtomValue(fretZoomAtom);

  // Fallback to props for testability, otherwise use atom-driven state
  const tuning = props.tuning ?? state.currentTuning;
  const maxFret = props.maxFret ?? MAX_FRET;
  const highlightNotes = props.highlightNotes ?? state.highlightNotes;
  const rootNote = props.rootNote ?? state.rootNote;
  const displayFormat = props.displayFormat ?? state.displayFormat;
  const boxBounds = props.boxBounds ?? state.boxBounds;
  const chordTones = props.chordTones ?? state.chordTones;
  const chordRoot = props.chordRoot ?? state.chordRoot;
  const chordFretSpread = props.chordFretSpread ?? state.chordFretSpread;
  const hideNonChordNotes = props.hideNonChordNotes ?? state.hideNonChordNotes;
  const viewMode = props.viewMode ?? state.viewMode;
  const autoCenterTarget = props.autoCenterTarget ?? state.autoCenterTarget;
  const recenterKey = props.recenterKey ?? state.recenterKey;
  const colorNotes = props.colorNotes ?? state.colorNotes;
  const shapePolygons = props.shapePolygons ?? state.shapePolygons;
  const wrappedNotes = props.wrappedNotes ?? state.wrappedNotes;
  const hiddenNotes = props.hiddenNotes ?? state.hiddenNotes;
  const useFlats = props.useFlats ?? state.useFlats;
  const scaleName = props.scaleName ?? state.scaleName;
  const startFret = state.startFret;
  const endFret = state.endFret;
  const stringRowPx = props.stringRowPx ?? STRING_ROW_PX_DEFAULT;

  const fretboardLayout = getFretboardNotes(tuning, Math.max(endFret, maxFret));

  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const totalColumns = endFret - startFret;
  const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
  const MIN_FRET_WIDTH = Math.max(MIN_FRET_WIDTH_BASE, noteBubblePx + MIN_FRET_WIDTH_OVERFLOW_BUFFER);
  
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
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
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

  const updateCursor = useCallback((dragging: boolean) => {
    if (!scrollRef.current) return;
    if (!hasOverflow) {
      scrollRef.current.style.cursor = "default";
      return;
    }
    scrollRef.current.style.cursor = dragging ? "grabbing" : "grab";
  }, [hasOverflow]);

  useEffect(() => {
    updateCursor(false);
  }, [updateCursor]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasOverflow) return;
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
    if (!isDraggingRef.current && dragDistance.current > 3) {
      isDraggingRef.current = true;
      updateCursor(true);
      pendingTarget.current?.setPointerCapture(pendingPointerId.current);
    }
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handlePointerUp = () => {
    if (isDraggingRef.current) {
      updateCursor(false);
    }
    isDraggingRef.current = false;
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
    if (props.onFretClick) props.onFretClick(stringIndex, fretIndex, noteName);
  };

  const neckWidth = totalColumns * effectiveZoom;

  return (
    <div 
      className="fretboard-outer" 
      data-testid="fretboard-main"
      style={{
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
          id={props.id}
          onNoteClick={handleFretClick}
        />
      </div>
    </div>
  );
}
