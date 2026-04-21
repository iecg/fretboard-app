import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { clsx } from "clsx";
import { useAtomValue } from "jotai";
import styles from "./Fretboard.module.css";
import {
  getFretboardNotes,
  getFretNoteWithOctave,
  getNoteFrequency,
} from "./guitar";
import { synth } from "./audio";
import { fretZoomAtom, type AutoCenterTarget } from "./store/atoms";
import { FretboardSVG } from "./FretboardSVG";
import { useFretboardState, type ShapeScope, type ActiveShapeType } from "./hooks/useFretboardState";
import {
  STRING_ROW_PX_DEFAULT,
  MAX_FRET,
  NOTE_BUBBLE_RATIO,
  NUT_WIDTH,
  MIN_FRET_WIDTH_BASE,
  MIN_FRET_WIDTH_OVERFLOW_BUFFER
} from "./constants";
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
  autoCenterTarget?: AutoCenterTarget;
  recenterKey?: number;
  activePattern?: "caged" | "3nps" | "all";
  activeShape?: ActiveShapeType;
  shapeScope?: ShapeScope;
  id?: string;
}

export function Fretboard(props: FretboardProps) {
  const state = useFretboardState();
  const fretZoom = useAtomValue(fretZoomAtom);

  // Fallback to props for testability; default to atom-driven state.
  const tuning = props.tuning ?? state.currentTuning;
  const maxFret = props.maxFret ?? MAX_FRET;
  const highlightNotes = props.highlightNotes ?? state.highlightNotes;
  const rootNote = props.rootNote ?? state.rootNote;
  const displayFormat = props.displayFormat ?? state.displayFormat;
  const boxBounds = props.boxBounds ?? state.boxBounds;
  const chordTones = props.chordTones ?? state.chordTones;
  const chordRoot = props.chordRoot ?? state.chordRoot;
  const chordFretSpread = props.chordFretSpread ?? state.chordFretSpread;
  const autoCenterTarget = props.autoCenterTarget ?? state.autoCenterTarget;
  const recenterKey = props.recenterKey ?? state.recenterKey;
  const colorNotes = props.colorNotes ?? state.colorNotes;
  const shapePolygons = props.shapePolygons ?? state.shapePolygons;
  const wrappedNotes = props.wrappedNotes ?? state.wrappedNotes;
  const hiddenNotes = props.hiddenNotes ?? state.hiddenNotes;
  const useFlats = props.useFlats ?? state.useFlats;
  const scaleName = props.scaleName ?? state.scaleName;
  const activePattern = props.activePattern ?? state.activePattern;
  const activeShape = props.activeShape ?? state.activeShape;
  const shapeScope = props.shapeScope ?? state.shapeScope;
  const noteSemantics = state.noteSemanticMap.size > 0 ? state.noteSemanticMap : undefined;
  const startFret = state.startFret;
  const endFret = state.endFret;
  const stringRowPx = props.stringRowPx ?? STRING_ROW_PX_DEFAULT;
  const onFretClickProp = props.onFretClick;
  const id = props.id;

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
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const dragDistance = useRef(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      if (entries.length === 0) return;
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

  useEffect(() => {
    if (!autoCenterTarget) return;
    const el = scrollRef.current;
    if (!el) return;
    const zoom = effectiveZoom;
    const containerW = el.clientWidth;
    if (containerW <= 0) return;

    // Match tapered fret coordinates from FretboardSVG for accurate scroll targeting.
    const neckWidth = totalColumns * zoom;
    const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
    const openWidth = startFret === 0 ? Math.max(noteBubblePx + 12, NUT_WIDTH + 4) : 0;
    const leftAnchor = startFret === 0 ? 1 : Math.pow(2, -(startFret - 1) / 12);
    const rightAnchor = Math.pow(2, -endFret / 12);
    const scaleRange = leftAnchor - rightAnchor || 1;
    const scalePx = (neckWidth - openWidth) / scaleRange;

    const wireX = (wireIndex: number): number => {
      if (startFret === 0 && wireIndex === 0) return openWidth;
      return openWidth + scalePx * (leftAnchor - Math.pow(2, -wireIndex / 12));
    };

    const shapeLeft = autoCenterTarget.minFret === 0 ? 0 : wireX(autoCenterTarget.minFret - 1);
    const shapeRight = wireX(autoCenterTarget.maxFret);
    const shapeCenter = (shapeLeft + shapeRight) / 2;

    el.scrollTo({ left: Math.max(0, shapeCenter - containerW / 2), behavior: "smooth" });
  }, [autoCenterTarget, recenterKey, startFret, endFret, effectiveZoom, stringRowPx, totalColumns, containerWidth]);

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

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!hasOverflow) return;
    if (!scrollRef.current) return;
    isDraggingRef.current = false;
    pendingPointerId.current = e.pointerId;
    pendingTarget.current = e.currentTarget;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    dragDistance.current = 0;
  }, [hasOverflow]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  }, [updateCursor]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      updateCursor(false);
    }
    isDraggingRef.current = false;
    pendingPointerId.current = null;
    pendingTarget.current = null;
  }, [updateCursor]);

  const handleFretClick = useCallback((
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
    if (onFretClickProp) onFretClickProp(stringIndex, fretIndex, noteName);
  }, [tuning, onFretClickProp]);

  const neckWidth = totalColumns * effectiveZoom;

  return (
    <div
      className={styles["fretboard-outer"]}
      data-testid="fretboard-outer"
      aria-label="Interactive guitar fretboard"
      style={{
        minHeight: `${tuning.length * stringRowPx + 24}px`
      }}
    >
      <div
        className={clsx(styles["fretboard-wrapper"], styles["hide-scrollbar"])}
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
          practiceLens={state.practiceLens}
          colorNotes={colorNotes}
          shapePolygons={shapePolygons}
          wrappedNotes={wrappedNotes}
          hiddenNotes={hiddenNotes}
          useFlats={useFlats}
          scaleName={scaleName}
          activePattern={activePattern}
          activeShape={activeShape}
          shapeScope={shapeScope}
          noteSemantics={noteSemantics}
          id={id}
          onNoteClick={handleFretClick}
        />
      </div>
    </div>
  );
}
