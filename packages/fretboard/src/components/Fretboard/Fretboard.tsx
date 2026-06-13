import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, lazy, Suspense, useDeferredValue } from "react";
import { useAtomValue } from "jotai";
import { clsx } from "clsx";
import styles from "./Fretboard.module.css";
import {
  getFretNoteWithOctave,
  getNoteFrequency,
} from "@fretflow/core";
import { playGuitarNote } from "../../core/lazyGuitarAudio";
import { audioModeAtom, fretboardEventSinkAtom } from "../../contract/embedAtoms";
import { getCachedFretboardLayout } from "../../core/fretboardLayoutCache";
import type { AutoCenterTarget } from "../../store/shapeAtoms";
const LazyFretboardSVG = lazy(() => 
  import("../FretboardSVG/FretboardSVG").then((m) => ({ default: m.FretboardSVG }))
);
import { getFretboardScale, getWireX } from "../FretboardSVG/fretboardGeometry";
import { FretboardSkeleton } from "./FretboardSkeleton";
import { useFretboardTopologyModel, type ShapeScope, type ActiveShapeType } from "../../hooks/useFretboardTopologyModel";
import { useEmphasisContext } from "../FretboardSVG/hooks/useEmphasisContext";
import { useFretboardViewportModel } from "../../hooks/useFretboardViewportModel";
import {
  STRING_ROW_PX_DEFAULT,
  MAX_FRET,
  NOTE_BUBBLE_RATIO,
  MIN_FRET_WIDTH_BASE,
  MIN_FRET_WIDTH_OVERFLOW_BUFFER
} from "@fretflow/core";
import type { ShapePolygon } from "@fretflow/core";
import type { BoxBound } from "../FretboardSVG/utils/semantics";

interface FretboardProps {
  /** String tuning ordered from high string (index 0) to low string; defaults to atom-driven state. */
  tuning?: string[];
  /** Maximum fret number rendered on the neck. */
  maxFret?: number;
  /** Notes to highlight as scale tones (stored as sharps, e.g. "C#"). */
  highlightNotes?: string[];
  /** Root note of the active scale, used for degree calculations and coloring. */
  rootNote?: string;
  /** Controls how notes are labeled inside bubbles: note names, scale degrees, or hidden. */
  displayFormat?: "notes" | "degrees" | "none";
  /** Chord tone note names to overlay on the fretboard. */
  chordTones?: string[];
  /** Root note of the active chord overlay. */
  chordRoot?: string;
  /** Fret spread of the chord voicing, used to size shape-constrained rendering. */
  chordFretSpread?: number;
  /**
   * Explicit fret-range bounds used exclusively for the chord-tone clamp.
   * Non-null only when the user has opted into position scoping AND a single
   * position is active. When null, chord tones are unbounded.
   */
  chordBoxBounds?: BoxBound[] | null;
  /** Notes to render with a special "color" highlight role. */
  colorNotes?: string[];
  /** CAGED / 3NPS shape polygon definitions to render as filled regions. */
  shapePolygons?: ShapePolygon[];
  /** Set of note names that wrap across the nut (open-string equivalents). */
  wrappedNotes?: Set<string>;
  /** Set of note names to suppress from rendering entirely. */
  hiddenNotes?: Set<string>;
  /** Callback fired when the user taps a fret; receives string index, fret index, and note name. */
  onFretClick?: (
    stringIndex: number,
    fretIndex: number,
    noteName: string,
  ) => void;
  /** When true, renders flat spellings instead of sharps where applicable. */
  preferFlats?: boolean;
  /** Name of the active scale (e.g. "Major", "Dorian"). */
  scaleName?: string;
  /** Height in pixels of each string row. */
  stringRowPx?: number;
  /** Fret range to scroll/center the viewport on after a shape change. */
  autoCenterTarget?: AutoCenterTarget;
  /** Incrementing key that re-triggers auto-centering without changing the target. */
  recenterKey?: number;
  /** Active fingering pattern system: CAGED, 3NPS, or none. */
  activePattern?: "caged" | "3nps" | "none";
  /** Selected shape within the active pattern (CAGED letter or 3NPS position number). */
  activeShape?: ActiveShapeType;
  /** Rendering scope for the chord overlay relative to the active shape. */
  shapeScope?: ShapeScope;
  /** Optional DOM id forwarded to the inner SVG element for stable references. */
  id?: string;
}

export function Fretboard(props: FretboardProps) {
  // Audio routing for the embed contract. Default mode is "builtin" and the
  // web app never sets it otherwise, so web behavior is unchanged.
  const audioMode = useAtomValue(audioModeAtom);
  const eventSink = useAtomValue(fretboardEventSinkAtom);
  const baseState = useFretboardTopologyModel();
  const state = useDeferredValue(baseState);
  const baseViewport = useFretboardViewportModel();
  const viewport = useDeferredValue(baseViewport);

  // Fallback to props for testability; default to atom-driven state.
  const tuning = props.tuning ?? viewport.currentTuning;
  const maxFret = props.maxFret ?? MAX_FRET;
  const highlightNotes = props.highlightNotes ?? state.highlightNotes;
  const rootNote = props.rootNote ?? state.rootNote;
  const displayFormat = props.displayFormat ?? state.displayFormat;
  // Chord-identity fields read from the UN-deferred `baseState` so they update
  // in lockstep with the voice-leading emphasis context, which is ALSO read in
  // THIS component (below) and passed down alongside them. Both signals must
  // travel through the same render: the displayed-step index is written inside
  // a startTransition (visualClock), which mutates the store immediately but
  // parks the React notifications in the low-priority transition lane. If
  // FretboardSVG subscribed to the emphasis atoms itself, an URGENT commit in
  // that window (e.g. the Tone.Draw audio-onset write flipping the countdown
  // atoms) re-rendered it with fresh emphasis reads (the NEW chord) while its
  // identity props were still the queued OLD chord — the chord-boundary
  // highlight flash. Reading identity + emphasis here, in one render, makes
  // every commit carry a consistent pair from a single store snapshot.
  const chordTones = props.chordTones ?? baseState.chordTones;
  const chordRoot = props.chordRoot ?? baseState.chordRoot;
  const chordFretSpread = props.chordFretSpread ?? state.chordFretSpread;
  const chordBoxBounds = props.chordBoxBounds !== undefined ? props.chordBoxBounds : state.chordBoxBounds;
  const autoCenterTarget = props.autoCenterTarget ?? viewport.autoCenterTarget;
  const recenterKey = props.recenterKey ?? viewport.recenterKey;
  const colorNotes = props.colorNotes ?? state.colorNotes;
  const shapePolygons = props.shapePolygons ?? state.shapePolygons;
  const wrappedNotes = props.wrappedNotes ?? state.wrappedNotes;
  const hiddenNotes = props.hiddenNotes ?? state.hiddenNotes;
  const preferFlats = props.preferFlats ?? state.preferFlats;
  const scaleName = props.scaleName ?? state.scaleName;
  const activePattern = props.activePattern ?? state.activePattern;
  const activeShape = props.activeShape ?? state.activeShape;
  const shapeScope = props.shapeScope ?? state.shapeScope;
  // Chord-identity (see chordTones/chordRoot above): use baseState so semantic
  // classification flips on the same render as the emphasis context.
  const noteSemantics = baseState.noteSemanticMap.size > 0 ? baseState.noteSemanticMap : undefined;
  // The emphasis context is read HERE — the same render (and store snapshot)
  // as the chord-identity fields above — and passed down, so identity and
  // emphasis can never tear across React priority lanes (see comment above).
  const emphasisContext = useEmphasisContext(chordTones.length > 0);
  const startFret = viewport.startFret;
  const endFret = viewport.endFret;
  const stringRowPx = props.stringRowPx ?? STRING_ROW_PX_DEFAULT;
  const onFretClickProp = props.onFretClick;
  const id = props.id;

  const fretboardLayout = getCachedFretboardLayout(tuning, Math.max(endFret, maxFret));

  // `baseState.fullChordPositions` is already a Set<string> sourced from
  // chordHighlightPositionsAtom — pass it through directly. The note-highlight
  // set is the union of ALL fitting voicing candidates' positions, decoupled
  // from `baseState.fullChordMatches` (the connector source). Both are read
  // from `baseState` (chord-identity) so they update in sync with the chord
  // tones above and the emphasis context (see comment on `chordTones`).
  const fullChordPositionKeys = baseState.fullChordPositions;

  const fullChordVoicings = useMemo(
    () =>
      baseState.fullChordMatches.map((match) => ({
        shape: match.shape,
        voicingKey: match.positionKeys.map((key) => key.replace("-", ",")).join("|"),
        notes: match.notes,
        isFallback: match.isFallback,
      })),
    [baseState.fullChordMatches],
  );

  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Math.max(window.innerWidth, 320);
  });
  const totalColumns = endFret - startFret;
  const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
  const MIN_FRET_WIDTH = Math.max(MIN_FRET_WIDTH_BASE, noteBubblePx + MIN_FRET_WIDTH_OVERFLOW_BUFFER);
  
  const autoFitZoom = Math.max(
    MIN_FRET_WIDTH,
    containerWidth > 0 && totalColumns > 0
      ? containerWidth / totalColumns
      : 40,
  );
  const desktopZoom =
    viewport.fretZoom <= 100 ? autoFitZoom : (autoFitZoom * viewport.fretZoom) / 100;
  const effectiveZoom = desktopZoom;

  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const pendingPointerId = useRef<number | null>(null);
  const pendingTarget = useRef<Element | null>(null);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const dragDistance = useRef(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
    let rafId: number | null = null;
    let pendingWidth = -1;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width <= 0) return;
      if (width === pendingWidth) return;
      pendingWidth = width;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setContainerWidth((prev) => (prev === pendingWidth ? prev : pendingWidth));
      });
    });
    ro.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    });
    return () => cancelAnimationFrame(id);
  }, [effectiveZoom, totalColumns, containerWidth]);

  // Keep the latest geometry decoupled from the centering effect to avoid jumpy scrolling
  const geometryRef = useRef({ effectiveZoom, totalColumns, stringRowPx, startFret, endFret });
  useLayoutEffect(() => {
    geometryRef.current = { effectiveZoom, totalColumns, stringRowPx, startFret, endFret };
  });

  useEffect(() => {
    if (!autoCenterTarget) return;
    const el = scrollRef.current;
    if (!el) return;
    const containerW = el.clientWidth;
    if (containerW <= 0) return;

    const { effectiveZoom, totalColumns, stringRowPx, startFret, endFret } = geometryRef.current;
    const neckWidth = totalColumns * effectiveZoom;
    const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
    
    const { openColumnWidth, scaleLeftAnchor, scalePx } = getFretboardScale(
      startFret,
      endFret,
      neckWidth,
      noteBubblePx
    );

    const wireX = (wireIndex: number): number =>
      getWireX(wireIndex, startFret, openColumnWidth, scalePx, scaleLeftAnchor);

    const shapeLeft = autoCenterTarget.minFret === 0 ? 0 : wireX(autoCenterTarget.minFret - 1);
    const shapeRight = wireX(autoCenterTarget.maxFret);
    const shapeCenter = (shapeLeft + shapeRight) / 2;

    el.scrollTo({ left: Math.max(0, shapeCenter - containerW / 2), behavior: "smooth" });
  }, [autoCenterTarget, recenterKey]);

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
    startX.current = e.pageX;
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
    const walk = (e.pageX - startX.current) * 1.5;
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

  const handleFretClick = useCallback(async (
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
    if (audioMode === "events") {
      eventSink?.({
        type: "noteActivated",
        frequency,
        note: fretNoteWithOctave,
        string: stringIndex,
        fret: fretIndex,
      });
    } else {
      await playGuitarNote(frequency);
    }
    if (onFretClickProp) onFretClickProp(stringIndex, fretIndex, noteName);
  }, [tuning, onFretClickProp, audioMode, eventSink]);

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
      >
        <Suspense 
          fallback={
            <FretboardSkeleton 
              neckWidthPx={neckWidth} 
              neckHeight={tuning.length * stringRowPx} 
              numStrings={tuning.length} 
              stringRowPx={stringRowPx} 
            />
          }
        >
          <LazyFretboardSVG
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
            chordBoxBounds={chordBoxBounds}
            chordTones={chordTones}
            chordRoot={chordRoot}
            chordFretSpread={chordFretSpread}
            colorNotes={colorNotes}
            shapePolygons={shapePolygons}
            wrappedNotes={wrappedNotes}
            hiddenNotes={hiddenNotes}
            preferFlats={preferFlats}
            scaleName={scaleName}
            activePattern={activePattern}
            activeShape={activeShape}
            shapeScope={shapeScope}
            noteSemantics={noteSemantics}
            fullChordPositionKeys={fullChordPositionKeys}
            fullChordVoicings={fullChordVoicings}
            emphasisContext={emphasisContext}
            showChordConnectors={state.showChordConnectors}
            id={id}
            onNoteClick={handleFretClick}
          />
        </Suspense>
      </div>
    </div>
  );
}
