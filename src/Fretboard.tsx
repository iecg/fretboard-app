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
import { 
  STRING_ROW_PX_DEFAULT, 
  MAX_FRET, 
  NOTE_BUBBLE_RATIO, 
  MIN_FRET_WIDTH_BASE, 
  MIN_FRET_WIDTH_OVERFLOW_BUFFER 
} from "./constants";
import {
  currentTuningAtom,
  rootNoteAtom,
  scaleNameAtom,
  fretStartAtom,
  fretEndAtom,
  displayFormatAtom,
  useFlatsAtom,
  shapeDataAtom,
  autoCenterTargetAtom,
  recenterKeyAtom,
  activeChordTonesAtom,
  chordRootAtom,
  chordFretSpreadAtom,
  hideNonChordNotesAtom,
  viewModeAtom,
  colorNotesAtom,
  hiddenNotesAtom,
  noteSemanticMapAtom,
  practiceLensAtom,
} from "./store/atoms";

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
  viewMode?: import("./theory").ViewMode;
  colorNotes?: string[];
  shapePolygons?: import("./shapes").ShapePolygon[];
  wrappedNotes?: Set<string>;
  hiddenNotes?: Set<string>;
  useFlats?: boolean;
  scaleName?: string;
  stringRowPx?: number;
  autoCenterTarget?: number;
  recenterKey?: number;
  onFretClick?: (
    stringIndex: number,
    fretIndex: number,
    noteName: string,
  ) => void;
  id?: string;
}

export function Fretboard(props: FretboardProps) {
  const fretZoom = useAtomValue(fretZoomAtom);
  const onFretClickProp = props.onFretClick;

  const atomTuning = useAtomValue(currentTuningAtom);
  const atomRootNote = useAtomValue(rootNoteAtom);
  const atomScaleName = useAtomValue(scaleNameAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);
  const atomDisplayFormat = useAtomValue(displayFormatAtom);
  const atomUseFlats = useAtomValue(useFlatsAtom);
  const shapeData = useAtomValue(shapeDataAtom);
  const atomHighlightNotes = shapeData.highlightNotes;
  const atomBoxBounds = shapeData.boxBounds;
  const atomShapePolygons = shapeData.shapePolygons;
  const atomWrappedNotes = shapeData.wrappedNotes;
  const atomAutoCenterTarget = useAtomValue(autoCenterTargetAtom);
  const atomRecenterKey = useAtomValue(recenterKeyAtom);

  const atomChordTones = useAtomValue(activeChordTonesAtom);
  const atomChordRoot = useAtomValue(chordRootAtom);
  const atomChordFretSpread = useAtomValue(chordFretSpreadAtom);
  const atomHideNonChordNotes = useAtomValue(hideNonChordNotesAtom);
  const atomViewMode = useAtomValue(viewModeAtom);
  const practiceLens = useAtomValue(practiceLensAtom);
  const atomColorNotes = useAtomValue(colorNotesAtom);
  const atomHiddenNotes = useAtomValue(hiddenNotesAtom);
  const noteSemanticMap = useAtomValue(noteSemanticMapAtom);

  // Props override atoms for test compatibility; otherwise use atoms
  const tuning = props.tuning ?? atomTuning;
  const rootNote = props.rootNote ?? atomRootNote;
  const scaleName = props.scaleName ?? atomScaleName;
  const displayFormat = props.displayFormat ?? atomDisplayFormat;
  const useFlats = props.useFlats ?? atomUseFlats;
  const highlightNotes = props.highlightNotes ?? atomHighlightNotes;
  const boxBounds = props.boxBounds ?? atomBoxBounds;
  const chordTones = props.chordTones ?? atomChordTones;
  const chordRoot = props.chordRoot ?? atomChordRoot;
  const chordFretSpread = props.chordFretSpread ?? atomChordFretSpread;
  const hideNonChordNotes = props.hideNonChordNotes ?? atomHideNonChordNotes;
  const viewMode = props.viewMode ?? atomViewMode;
  const autoCenterTarget = props.autoCenterTarget ?? atomAutoCenterTarget;
  const recenterKey = props.recenterKey ?? atomRecenterKey;
  const colorNotes = props.colorNotes ?? atomColorNotes;
  const shapePolygons = props.shapePolygons ?? atomShapePolygons;
  const wrappedNotes = props.wrappedNotes ?? atomWrappedNotes;
  const hiddenNotes = props.hiddenNotes ?? atomHiddenNotes;
  const id = props.id;

  const stringRowPx = props.stringRowPx ?? STRING_ROW_PX_DEFAULT;
  const maxFret = props.maxFret ?? MAX_FRET;

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
      className="fretboard-outer" 
      data-testid="fretboard-main"
      aria-label="Interactive guitar fretboard"
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
          practiceLens={practiceLens}
          colorNotes={colorNotes}
          shapePolygons={shapePolygons}
          wrappedNotes={wrappedNotes}
          hiddenNotes={hiddenNotes}
          useFlats={useFlats}
          scaleName={scaleName}
          noteSemantics={noteSemanticMap.size > 0 ? noteSemanticMap : undefined}
          id={id}
          onNoteClick={handleFretClick}
        />
      </div>
    </div>
  );
}
