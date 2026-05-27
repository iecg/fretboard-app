import { useId, useMemo, useCallback, type CSSProperties } from "react";
import { useAtomValue } from "jotai";
import { useReducedMotion } from "motion/react";
import {
  getNoteDisplay,
  getScaleSemitones,
  type PracticeLens,
  type NoteSemantics,
} from "@fretflow/core";
import { fingeringPatternAtom } from "../../store/fingeringAtoms";
import { intervalPairsAtom } from "../../store/shapeAtoms";
import { scaleDegreeColorsEnabledAtom } from "../../store/uiAtoms";
import { useFretboardPlaybackSnapshot } from "./hooks/useFretboardPlaybackSnapshot";
import { STRING_ROW_PX_TABLET } from "../../layout/responsive";
import styles from "./FretboardSVG.module.css";
import { useFretboardGeometry } from "./hooks/useFretboardGeometry";
import { useChordConnectorPolylines, CHORD_TONE_CLASSES } from "./hooks/useChordConnectorPolylines";
import { useIntervalConnectorPolylines } from "./hooks/useIntervalConnectorPolylines";
import { useStaticFretboardTopology } from "./hooks/useStaticFretboardTopology";
import { useAnimatedFretboardView } from "./hooks/useAnimatedFretboardView";
import { type BoxBound } from "./utils/semantics";
import { FretboardBackground } from "./FretboardBackground";
import { FretboardDefs } from "./FretboardDefs";
import { FretboardShapeLayer } from "./FretboardShapeLayer";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
import { FretboardHitTargetLayer } from "./FretboardHitTargetLayer";
import { FretboardConnectorLayer } from "./FretboardConnectorLayer";
import { FretNumbersRow } from "./FretNumbersRow";
import { resolveFretboardMotionPolicy } from "./motionPolicy";
import type { CagedShape, FullChordMatchNote, ShapePolygon } from "@fretflow/core";
import type { ActiveShapeType } from "../../hooks/useFretboardState";
import {
  INLAY_FRETS,
  INLAY_DOUBLE_FRETS,
  MAX_FRET,
  NOTE_BUBBLE_RATIO,
  NOTE_FONT_RATIO,
  INLAY_RADIUS_RATIO,
  INLAY_RADIUS_MIN,
} from "@fretflow/core";

const DEFAULT_WRAPPED_NOTES = new Set<string>();
const DEFAULT_COLOR_NOTES: string[] = [];
const DEFAULT_SHAPE_POLYGONS: ShapePolygon[] = [];
const DEFAULT_CHORD_TONES: string[] = [];

interface FretboardSVGProps {
  /** Pixels per fret column used to size the scroll container; passed through but not read internally. */
  effectiveZoom: number;
  /** Total rendered neck width in pixels. */
  neckWidthPx: number;
  /** First fret column visible in the viewport (0 = open strings). */
  startFret: number;
  /** Last fret column visible in the viewport (exclusive upper bound). */
  endFret: number;
  /** Height in pixels of each string row. */
  stringRowPx?: number;
  /** Pre-computed 2-D note name grid: fretboardLayout[string][fret]. */
  fretboardLayout: string[][];
  /** String tuning ordered from high string (index 0) to low string. */
  tuning: string[];
  /** Total fret count on the neck; caps note rendering. */
  maxFret?: number;
  /** Notes to highlight as scale tones (stored as sharps). */
  highlightNotes: string[];
  /** Root note of the active scale, used for degree labels and color mapping. */
  rootNote: string;
  /** Controls the label style inside note bubbles. */
  displayFormat?: "notes" | "degrees" | "none";
  /**
   * Explicit fret-range bounds used exclusively for the chord-tone clamp.
   * Non-null only when the user has opted into position scoping AND a single
   * position is active. When null, chord tones are unbounded — any chord tone
   * receives the chord-overlay treatment regardless of fingering pattern.
   */
  chordBoxBounds?: BoxBound[] | null;
  /** Chord tone note names to overlay on the fretboard. */
  chordTones?: string[];
  /** Root note of the active chord overlay. */
  chordRoot?: string;
  /** Fret spread of the chord voicing, used for shape-constrained rendering. */
  chordFretSpread?: number;
  /** Active practice lens that drives note emphasis rules (colors, tension cues, squircles). */
  practiceLens?: PracticeLens;
  /** Notes to render with the special "color" highlight role. */
  colorNotes?: string[];
  /** CAGED / 3NPS shape polygons to render as filled regions behind the notes. */
  shapePolygons?: ShapePolygon[];
  /** Set of note names that wrap across the nut (open-string equivalents). */
  wrappedNotes?: Set<string>;
  /** Set of note names to suppress from rendering entirely. */
  hiddenNotes?: Set<string>;
  /** When true, renders flat spellings instead of sharps where applicable. */
  preferFlats?: boolean;
  /** Name of the active scale, used for degree color mapping and aria label. */
  scaleName?: string;
  /**
   * Active pattern context for shape-constrained chord overlay rendering.
   * When provided along with activeShape, the chord overlay will only highlight
   * chord tones that fall within the active shape/position boundaries.
   */
  activePattern?: "caged" | "3nps" | "none";
  /**
   * Active shape (CAGED letter or 3NPS position number) for shape-constrained
   * chord overlay rendering.
   */
  activeShape?: ActiveShapeType;
  /**
   * Shape scope context: distinguishes single-shape, multi-shape, and global rendering modes.
   * - "single": chord overlay constrained to one specific shape/position
   * - "multi": chord overlay spans multiple CAGED shapes or applies to current 3NPS position
   * - "global": chord overlay applies to all visible shapes (fingeringPattern="all")
   */
  shapeScope?: "single" | "multi" | "global";
  /**
   * Composable per-note semantics from noteSemanticMapAtom. When provided,
   * each rendered note element gains supplementary data attributes
   * (data-note-tension, data-note-guide-tone) so a note can carry multiple
   * semantic roles simultaneously — e.g. chord root AND tension note.
   */
  noteSemantics?: Map<string, NoteSemantics>;
  fullChordPositionKeys?: Set<string>;
  fullChordVoicings?: Array<{
    voicingKey: string;
    notes: FullChordMatchNote[];
    shape?: CagedShape;
    /** Close-voicing fallback flag — toggles dashed connector stroke. */
    isFallback?: boolean;
  }>;
  /** When false, chord voicing connector polylines are not rendered. Defaults to true. */
  showChordConnectors?: boolean;
  /** Optional DOM id applied to the SVG wrapper for stable external references. */
  id?: string;
  /** Callback fired when the user clicks a note bubble; receives string index, fret index, and note name. */
  onNoteClick?: (
    stringIndex: number,
    fretIndex: number,
    noteName: string,
  ) => void;
  /**
   * Playback snapshot for lead-lens emphasis. When omitted, FretboardSVG subscribes
   * to playback atoms internally so the Fretboard shell stays isolated from frame ticks.
   * Tests may inject a snapshot directly to avoid atom setup.
   */
  playbackSnapshot?: import("./hooks/useFretboardPlaybackSnapshot").FretboardPlaybackSnapshot | null;
}

export function FretboardSVG({
  effectiveZoom,
  neckWidthPx,
  startFret,
  endFret,
  stringRowPx = STRING_ROW_PX_TABLET,
  fretboardLayout,
  tuning,
  maxFret = MAX_FRET,
  highlightNotes,
  rootNote,
  displayFormat = "notes",
  chordBoxBounds = null,
  chordTones = DEFAULT_CHORD_TONES,
  chordRoot,
  chordFretSpread = 0,
  practiceLens,
  colorNotes = DEFAULT_COLOR_NOTES,
  shapePolygons = DEFAULT_SHAPE_POLYGONS,
  wrappedNotes = DEFAULT_WRAPPED_NOTES,
  hiddenNotes,
  preferFlats = false,
  scaleName = "",
  activePattern,
  activeShape,
  shapeScope,
  noteSemantics,
  fullChordPositionKeys,
  fullChordVoicings,
  showChordConnectors = true,
  id,
  onNoteClick,
  playbackSnapshot: playbackSnapshotProp,
}: FretboardSVGProps) {
  // `effectiveZoom` stays on the prop surface (callers size the scroll area
  // around it) but non-uniform spacing inside this component is derived from
  // neckWidthPx + scale math, so the value isn't read here.
  void effectiveZoom;
  const degreeColorsEnabled = useAtomValue(scaleDegreeColorsEnabledAtom);
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const intervalPairs = useAtomValue(intervalPairsAtom);

  // Playback snapshot is subscribed here (inside the lazy boundary) so that
  // frame ticks do not re-render the Fretboard shell. Tests may inject the
  // snapshot directly via the prop to avoid atom setup.
  const internalPlaybackSnapshot = useFretboardPlaybackSnapshot(
    playbackSnapshotProp === undefined ? practiceLens : undefined,
  );
  const playbackSnapshot = playbackSnapshotProp !== undefined
    ? playbackSnapshotProp
    : internalPlaybackSnapshot;

  const internalId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const defsPrefix = `fretboard-${id ?? internalId}`;
  const svgDefId = useCallback((id: string) => `${defsPrefix}-${id}`, [defsPrefix]);
  const svgDefUrl = useCallback((id: string) => `url(#${svgDefId(id)})`, [svgDefId]);
  const glowFilterUrls = useMemo(() => ({
    cyan: svgDefUrl("glow-cyan"),
    orange: svgDefUrl("glow-orange"),
    violet: svgDefUrl("glow-violet"),
  }), [svgDefUrl]);

  const noteBubblePx = Math.round(stringRowPx * NOTE_BUBBLE_RATIO);
  const noteFontPx = Math.round(stringRowPx * NOTE_FONT_RATIO);
  // Playable neck height — strings, frets, inlays, and shape polygons all
  // live within this box, matching the original (pre-connector-fix)
  // proportions of a guitar fretboard.
  const neckHeight = tuning.length * stringRowPx;
  const totalColumns = endFret - startFret;
  const hasChordOverlay = chordTones.length > 0;
  const numStrings = tuning.length;
  const connectorYBounds = useMemo(
    () => ({ minY: 0, maxY: neckHeight }),
    [neckHeight],
  );

  const {
    wireXRel,
    fretToX,
    fretCenterX,
    fretColumnWidth,
    taperYLeft,
    taperPath,
    cornerR,
    stringYAt,
  } = useFretboardGeometry({
    startFret,
    endFret,
    maxFret,
    neckWidthPx,
    neckHeight,
    noteBubblePx,
    numStrings,
  });

  // Stable polygon data — identity is anchored to shapePolygons only.
  // Does not depend on pixel-space functions so zoom/scroll do not invalidate it.
  const polygonData = useMemo(() => {
    return shapePolygons.map((poly, polyIdx) => ({
      verts: poly.vertices,
      halfVerts: poly.vertices.length / 2,
      color: poly.color,
      key: `${poly.shape}-${polyIdx}`,
      poly,
    }));
  }, [shapePolygons]);

  // Pixel transform — cheap iteration over stable polygonData.
  // Recomputes on zoom/scroll (fretToX, stringYAt, neckHeight change) but
  // polygonData reference stays the same so only this memo re-runs.
  const svgPolygons = useMemo(() => {
    return polygonData.map(({ verts, halfVerts, color, key, poly }) => {
      if (verts.length === 0) {
        return {
          points: "",
          color,
          key,
          poly,
          centerX: 0,
        };
      }
      const pixelPoints: string[] = [];

      // Vertex frets are used as-is. A vertex stays off-board only when its
      // template offset truly puts it there (i.e., the scale would have a
      // note at the imaginary fret). Vertices that legitimately sit at fret 0
      // or maxFret are not pulled to intendedMin/intendedMax — that flattened
      // mixed-offset templates and produced spurious off-board extension.

      pixelPoints.push(`${fretToX(verts[0].fret)},0`);
      for (let i = 0; i < halfVerts; i++) {
        const fx = fretToX(verts[i].fret);
        pixelPoints.push(`${fx},${stringYAt(verts[i].string, fx)}`);
      }
      pixelPoints.push(
        `${fretToX(verts[halfVerts - 1].fret)},${neckHeight}`,
      );
      pixelPoints.push(
        `${fretToX(verts[halfVerts].fret)},${neckHeight}`,
      );
      for (let i = halfVerts; i < verts.length; i++) {
        const fx = fretToX(verts[i].fret);
        pixelPoints.push(`${fx},${stringYAt(verts[i].string, fx)}`);
      }
      pixelPoints.push(
        `${fretToX(verts[verts.length - 1].fret)},0`,
      );

      const points = pixelPoints.join(" ");
      const s5Center = (verts[halfVerts - 1].fret + verts[halfVerts].fret) / 2;
      const centerX = fretToX(Math.max(startFret, Math.min(endFret, s5Center)));
      return {
        points,
        color,
        key,
        poly,
        centerX,
      };
    });
  }, [polygonData, startFret, endFret, neckHeight, fretToX, stringYAt]);

  const displayRoot = rootNote
    ? getNoteDisplay(rootNote, rootNote, preferFlats)
    : "";
  // If multiple fullChordVoicings map to the same positionKey, shapeByPosition
  // keeps the first shape encountered so note colors stay deterministic.
  const fullChordShapeByPosition = useMemo(() => {
    const shapeByPosition = new Map<string, CagedShape>();
    for (const voicing of fullChordVoicings ?? []) {
      if (!voicing.shape) continue;
      for (const note of voicing.notes) {
        const positionKey = `${note.stringIndex}-${note.fretIndex}`;
        if (!shapeByPosition.has(positionKey)) {
          shapeByPosition.set(positionKey, voicing.shape);
        }
      }
    }
    return shapeByPosition;
  }, [fullChordVoicings]);
  const ariaLabel = [
    "Guitar fretboard",
    displayRoot ? `— ${displayRoot}` : "",
    scaleName ? `${scaleName} scale` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inlayY = useMemo(() => neckHeight / 2, [neckHeight]);
  const inlayYTopAt = useCallback((x: number) =>
    numStrings >= 4
      ? (stringYAt(1, x) + stringYAt(2, x)) / 2
      : stringYAt(0, x) + (stringYAt(numStrings - 1, x) - stringYAt(0, x)) / 3, [numStrings, stringYAt]);
  const inlayYBottomAt = useCallback((x: number) =>
    numStrings >= 4
      ? (stringYAt(numStrings - 3, x) + stringYAt(numStrings - 2, x)) / 2
      : stringYAt(0, x) +
        ((stringYAt(numStrings - 1, x) - stringYAt(0, x)) * 2) / 3, [numStrings, stringYAt]);

  const inlays = useMemo(() => {
    const inlayR = Math.max(INLAY_RADIUS_MIN, stringRowPx * INLAY_RADIUS_RATIO);
    const maxFretVisible = startFret + totalColumns;

    const singles = INLAY_FRETS
      .filter((f) => f >= startFret && f <= maxFretVisible)
      .map((fretIndex) => {
        const x = fretCenterX(fretIndex);
        return (
          <circle
            key={`inlay-${fretIndex}`}
            data-fret-marker={fretIndex}
            cx={x}
            cy={inlayY}
            r={inlayR}
            fill={svgDefUrl("inlay-pearl")}
            filter={svgDefUrl("inlay-shadow")}
          />
        );
      });

    const doubles = INLAY_DOUBLE_FRETS
      .filter((f) => f >= startFret && f <= maxFretVisible)
      .map((fretIndex) => {
        const x = fretCenterX(fretIndex);
        return (
          <g key={`inlay-${fretIndex}`} data-fret-marker={fretIndex} data-double-marker="true">
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
      });

    return [...singles, ...doubles];
  }, [totalColumns, startFret, stringRowPx, svgDefUrl, fretCenterX, inlayY, inlayYBottomAt, inlayYTopAt]);

  const topology = useStaticFretboardTopology({
    numStrings,
    fretboardLayout,
    totalColumns,
    startFret,
    maxFret,
    hiddenNotes,
    highlightNotes,
    hasChordOverlay,
    chordTones,
    rootNote,
    chordRoot,
    colorNotes,
    shapePolygons,
    chordBoxBounds,
    chordFretSpread,
    activePattern,
    shapeScope,
    activeShape,
    scaleName: scaleName || "",
    preferFlats,
    displayFormat,
    degreeColorsEnabled,
    wrappedNotes,
    tuning,
    noteSemantics,
    fullChordPositionKeys,
    fullChordShapeByPosition,
  });
  const { renderedNotes } = useAnimatedFretboardView({
    topology,
    playbackSnapshot,
    practiceLens,
    hasChordOverlay,
    displayFormat,
    degreeColorsEnabled,
    preferFlats,
    scaleName: scaleName || "",
    rootNote,
    fretCenterX,
    stringYAt,
  });

  // Scale semitone offsets (0-11) drive per-pair color via scale-degree position
  // on the interval connector polylines.
  const scaleSemitones = useMemo(() => {
    if (!scaleName || !rootNote) return [];
    return getScaleSemitones(rootNote, scaleName);
  }, [scaleName, rootNote]);

  const intervalConnectorPolylines = useIntervalConnectorPolylines({
    intervalPairs,
    tuning,
    scaleSemitones,
    fretCenterX,
    stringYAt,
    stringRowPx,
    yBounds: connectorYBounds,
  });

  // Pre-filter stable topology to the chord-tone subset so playback-frame
  // animation updates do not trigger expensive connector recalculation.
  const chordNoteData = useMemo(
    () => topology.filter((n) => CHORD_TONE_CLASSES.has(n.noteClass)),
    [topology],
  );

  // Per-string chord filter (UAT-3): when fingering pattern restricts to 1 or 2 strings,
  // highlightNotes already contains only those string coords, so chord-tone role naturally
  // applies only to in-pattern notes. Chord connectors are suppressed separately here
  // because cross-string voicings do not make sense in a 1/2-string context.
  const connectorPolylines = useChordConnectorPolylines({
    noteData: chordNoteData,
    chordToneNames:
      fingeringPattern === "one-string" || fingeringPattern === "two-strings"
        ? []
        : chordTones,
    fretCenterX,
    stringYAt,
    stringRowPx,
    yBounds: connectorYBounds,
    explicitVoicings: fullChordVoicings,
    voicingSourceActive: hasChordOverlay,
  });
  // When a chord overlay is active the voicing engine is the only source —
  // never label the layer "generated", even when the engine returns nothing.
  const connectorSource = hasChordOverlay ? "full-chord" : "generated";

  const prefersReducedMotion = useReducedMotion() ?? false;
  const motionPolicy = useMemo(
    () => resolveFretboardMotionPolicy({ prefersReducedMotion }),
    [prefersReducedMotion],
  );

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={styles["fretboard-board"]}
      data-practice-lens={hasChordOverlay ? practiceLens : undefined}
      data-degree-colors={degreeColorsEnabled ? "true" : undefined}
      data-full-chord-mode={fullChordVoicings?.length ? "true" : undefined}
      data-testid="fretboard-svg"
    >
      <div
        className={styles["fretboard-neck"]}
        style={
          {
            height: `${neckHeight}px`,
            width: `${neckWidthPx}px`,
            willChange: "transform",
            "--string-row-px": `${stringRowPx}px`,
            "--fretboard-svg-glow-cyan-url": glowFilterUrls.cyan,
            "--fretboard-svg-glow-orange-url": glowFilterUrls.orange,
            "--fretboard-svg-glow-violet-url": glowFilterUrls.violet,
          } as CSSProperties
        }
      >
        {/* Visual SVG — aria-hidden; accessible buttons rendered separately below */}
        <svg
          className={styles["fretboard-main-svg"]}
          width={neckWidthPx}
          height={neckHeight}
          style={{
            display: "block",
            position: "absolute",
            top: 0,
            left: 0,
          }}
          aria-hidden="true"
        >
          <FretboardDefs
            svgDefId={svgDefId}
            neckWidthPx={neckWidthPx}
            neckHeight={neckHeight}
            taperPath={taperPath}
          />

          <FretboardBackground
            neckWidthPx={neckWidthPx}
            neckHeight={neckHeight}
            startFret={startFret}
            maxFret={maxFret}
            tuning={tuning}
            stringYAt={stringYAt}
            wireXRel={wireXRel}
            svgDefUrl={svgDefUrl}
            taperYLeft={taperYLeft}
            cornerR={cornerR}
            inlays={inlays}
          />

          <g clipPath={svgDefUrl("fretboard-taper")}>
            <FretboardShapeLayer svgPolygons={svgPolygons} animationMode={motionPolicy.shapeMode} />
          </g>

          {/* Non-chord notes render BEFORE connectors so connectors paint on top. */}
          {hasChordOverlay && (
            <g clipPath={svgDefUrl("fretboard-taper")}>
              <FretboardNoteLayer
                notes={renderedNotes}
                noteBubblePx={noteBubblePx}
                displayFormat={displayFormat}
                degreeColorsEnabled={degreeColorsEnabled}
                onNoteClick={onNoteClick}
                filter="non-chord"
                animationMode={motionPolicy.noteMode}
              />
            </g>
          )}

          {/* Chord + interval connectors render OUTSIDE the wood `fretboard-taper`
              clip so geometry that crosses the wood's tapered top/bottom + nut/body
              edges near the outer strings stays visible. They are clipped to the
              SVG's bounding box (`fretboard-svg-box`). Connector pixels that land
              in the taper-carved corner gaps paint on the app-container backdrop —
              that's an accepted trade-off; the wood gradient stays clipped to the
              taper and does not overflow. */}
          <FretboardConnectorLayer
            chordPolylines={connectorPolylines}
            intervalPolylines={intervalConnectorPolylines}
            connectorSource={connectorSource}
            chordRoot={chordRoot}
            chordTones={chordTones}
            showChordConnectors={showChordConnectors}
            connectorMotionMode={motionPolicy.connectorMode}
            clipPathUrl={svgDefUrl("fretboard-svg-box")}
          />

          {/* Chord notes (or all notes when no overlay) render LAST — on top of connectors. */}
          <g clipPath={svgDefUrl("fretboard-taper")}>
            <FretboardNoteLayer
              notes={renderedNotes}
              noteBubblePx={noteBubblePx}
              displayFormat={displayFormat}
              degreeColorsEnabled={degreeColorsEnabled}
              onNoteClick={onNoteClick}
              filter={hasChordOverlay ? "chord" : undefined}
              animationMode={motionPolicy.noteMode}
            />
          </g>
        </svg>

        <FretboardHitTargetLayer
          noteData={topology}
          fretCenterX={fretCenterX}
          stringYAt={stringYAt}
          noteBubblePx={noteBubblePx}
          noteFontPx={noteFontPx}
          neckWidthPx={neckWidthPx}
          neckHeight={neckHeight}
          onNoteClick={onNoteClick}
        />
      </div>

      <FretNumbersRow
        totalColumns={totalColumns}
        startFret={startFret}
        maxFret={maxFret}
        neckWidthPx={neckWidthPx}
        fretColumnWidth={fretColumnWidth}
      />
    </div>
  );
}
