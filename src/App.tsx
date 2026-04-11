import { useState, useMemo, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom, createStore, Provider } from "jotai";
import { Fretboard } from "./Fretboard";
import {
  SCALES,
  NOTES,
  INTERVAL_NAMES,
  CHORDS,
  getScaleNotes,
  getChordNotes,
  getIntervalNotes,
  getNoteDisplay,
  getNoteDisplayInScale,
  getDivergentNotes,
  formatAccidental,
} from "./theory";
import { STANDARD_TUNING, TUNINGS } from "./guitar";
import {
  Music,
  Settings2,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react";
import { synth } from "./audio";
import { CircleOfFifths } from "./CircleOfFifths";
import { DEGREE_COLORS, getDegreesForScale } from "./degrees";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  type ShapePolygon,
} from "./shapes";
import { DrawerSelector } from "./DrawerSelector";
import { FingeringPatternControls } from "./components/FingeringPatternControls";
import { ScaleChordControls } from "./components/ScaleChordControls";
import { TabletPortraitPanel } from "./components/TabletPortraitPanel";
import { MobileTabPanel } from "./components/MobileTabPanel";
import { ExpandedControlsPanel } from "./components/ExpandedControlsPanel";
import { FretRangeControl } from "./components/FretRangeControl";
import { StepperControl } from "./components/StepperControl";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  hideNonChordNotesAtom,
  chordFretSpreadAtom,
  chordIntervalFilterAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  displayFormatAtom,
  shapeLabelsAtom,
  tuningNameAtom,
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  useFlatsAtom,
  isMutedAtom,
  mobileTabAtom,
  tabletTabAtom,
  setRootNoteAtom,
  resetAtom,
  settingsOverlayOpenAtom,
} from "./store/atoms";
import SettingsOverlay from "./components/SettingsOverlay";
import {
  CONTROL_HEIGHTS,
  FRETBOARD_MIN_HEIGHT,
  LAYOUT_CHROME_HEIGHT,
} from "./layout/constants";
import "./App.css";

const END_FRET = 24;

type LayoutMode =
  | "mobile"
  | "landscape-mobile"
  | "tablet-portrait"
  | "desktop-expanded";

function SummaryNote({
  note,
  rootNote,
  scaleName,
  displayName,
  isChord,
}: {
  note: string;
  rootNote: string;
  scaleName: string;
  displayName: string;
  isChord?: boolean;
}) {
  const rootIdx = NOTES.indexOf(rootNote);
  const noteIdx = NOTES.indexOf(note);
  const chromaticInterval = rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : -1;
  const degree = chromaticInterval !== -1 ? INTERVAL_NAMES[chromaticInterval] : null;
  const romanNumeral = chromaticInterval !== -1 ? getDegreesForScale(scaleName)[chromaticInterval] : undefined;
  const degreeColor = romanNumeral ? DEGREE_COLORS[romanNumeral] : undefined;
  return (
    <span
      className={`summary-note${isChord ? " summary-note--chord" : ""}`}
      style={degreeColor ? { outline: `2px solid ${degreeColor}`, outlineOffset: "-2px" } : undefined}
    >
      <span className="summary-note-name">{formatAccidental(displayName)}</span>
      {degree && (
        <span className="summary-note-degree" style={{ color: degreeColor }}>{formatAccidental(degree)}</span>
      )}
    </span>
  );
}

// Chord interval filter presets — sets of allowed semitone intervals from chord root
const CHORD_INTERVAL_FILTERS: Record<string, Set<number>> = {
  All: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  Triad: new Set([0, 3, 4, 6, 7, 8]),
  "7th Chord": new Set([0, 3, 4, 6, 7, 8, 10, 11]),
  "Power Chord": new Set([0, 7]),
  "Guide Tones": new Set([3, 4, 10, 11]),
  "Shell Voicing": new Set([0, 3, 4, 10, 11]),
  "Root & 3rd": new Set([0, 3, 4]),
  "Root & 5th": new Set([0, 6, 7, 8]),
  "Root & 7th": new Set([0, 10, 11]),
  "3rd & 5th": new Set([3, 4, 6, 7, 8]),
  "3rd & 7th": new Set([3, 4, 10, 11]),
};
const CHORD_FILTER_OPTIONS = Object.keys(CHORD_INTERVAL_FILTERS);

const SCALE_OPTIONS: (string | { divider: string })[] = [
  { divider: "Major Modes" },
  "Major",
  "Lydian",
  "Mixolydian",
  { divider: "Minor Modes" },
  "Natural Minor",
  "Dorian",
  "Phrygian",
  "Locrian",
  { divider: "Harmonic" },
  "Harmonic Minor",
  { divider: "Pentatonic" },
  "Minor Pentatonic",
  "Major Pentatonic",
  { divider: "Blues" },
  "Minor Blues",
  "Major Blues",
];

const CHORD_OPTIONS: (string | { divider: string })[] = [
  { divider: "Triads" },
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  { divider: "Seventh Chords" },
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  { divider: "Other" },
  "Power Chord (5)",
];

function AppContent() {
  // Scale
  const rootNote = useAtomValue(rootNoteAtom);
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);

  // Chord overlay
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const [hideNonChordNotes, setHideNonChordNotes] = useAtom(hideNonChordNotesAtom);
  const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);
  const [chordIntervalFilter, setChordIntervalFilter] = useAtom(chordIntervalFilterAtom);

  // Fingering
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);

  // Display
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [shapeLabels, setShapeLabels] = useAtom(shapeLabelsAtom);
  const [tuningName, setTuningName] = useAtom(tuningNameAtom);
  const [fretZoom, setFretZoom] = useAtom(fretZoomAtom);
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);

  // Accidentals / Audio / Mobile tab
  const [useFlats, setUseFlats] = useAtom(useFlatsAtom);
  const [isMuted, setIsMuted] = useAtom(isMutedAtom);
  const [mobileTab, setMobileTab] = useAtom(mobileTabAtom);

  // Settings overlay (non-persisted)
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);

  // Viewport / mobile detection (not persisted)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const handler = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const isLandscapeMobile =
    viewportWidth < 768 && viewportHeight < viewportWidth;
  const isMobile = viewportWidth < 768 || isLandscapeMobile;

  // Adaptive fit: pick desktop-expanded (Target A) when the fully-
  // expanded controls fit vertically; otherwise fall back to the
  // tablet-portrait tabbed layout. Constants measured against the
  // live app — see src/layout/constants.ts.
  const targetAHeight = Math.max(
    CONTROL_HEIGHTS.settings +
      CONTROL_HEIGHTS.rowGap +
      CONTROL_HEIGHTS.scaleChord,
    CONTROL_HEIGHTS.cofMax,
  );
  const chromeHeight =
    LAYOUT_CHROME_HEIGHT.header +
    LAYOUT_CHROME_HEIGHT.summary +
    LAYOUT_CHROME_HEIGHT.version +
    LAYOUT_CHROME_HEIGHT.outerGap;
  const availableControlsHeight =
    viewportHeight - chromeHeight - FRETBOARD_MIN_HEIGHT;
  const fitsExpanded =
    viewportWidth >= 768 &&
    !isLandscapeMobile &&
    availableControlsHeight >= targetAHeight;

  const layoutMode: LayoutMode = isLandscapeMobile
    ? "landscape-mobile"
    : isMobile
      ? "mobile"
      : fitsExpanded
        ? "desktop-expanded"
        : "tablet-portrait";
  const isTabletPortrait = layoutMode === "tablet-portrait";
  const isDesktopExpanded = layoutMode === "desktop-expanded";

  // String row height — reduced on small phones (≤800px tall, e.g. iPhone SE at 667px) to fit
  // the fretboard natively without squishing it horizontally via transform:scale().
  // Threshold matches the CSS small-phone media query (max-height: 800px).
  const stringRowPx = (isMobile && viewportHeight <= 800) ? 32 : 40;

  // Tablet-portrait tab state (Jotai atom with localStorage persistence)
  const [tabletTab, setTabletTab] = useAtom(tabletTabAtom);

  // Sync mute state to audio synth (runs on mount and whenever isMuted changes)
  useEffect(() => {
    synth.setMute(isMuted);
  }, [isMuted]);

  const currentTuning = TUNINGS[tuningName] || STANDARD_TUNING;

  // Linked root note setter — syncs chordRoot when linkChordRoot is enabled
  const handleSetRootNote = useSetAtom(setRootNoteAtom);

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    synth.setMute(nextMute);
  };

  const dispatchReset = useSetAtom(resetAtom);
  const handleReset = () => {
    dispatchReset();
    synth.setMute(false);
  };

  // Compute active chord tones (independent of scale)
  const chordTones = useMemo(() => {
    if (!chordType) return [];
    return getChordNotes(chordRoot, chordType);
  }, [chordRoot, chordType]);

  // Apply interval filter to chord tones (always preserve root)
  const filteredChordTones = useMemo(() => {
    if (!chordType || chordIntervalFilter === "All") return chordTones;
    const allowed = CHORD_INTERVAL_FILTERS[chordIntervalFilter];
    const intervals = CHORDS[chordType];
    if (!intervals || !allowed) return chordTones;
    const filtered = intervals.filter((i) => allowed.has(i));
    // Always include root (interval 0) so root-active classification stays anchored
    if (!filtered.includes(0)) filtered.unshift(0);
    return getIntervalNotes(chordRoot, filtered);
  }, [chordRoot, chordType, chordIntervalFilter, chordTones]);

  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } =
    useMemo(() => {
      let coords: string[] = [];
      let bounds: { minFret: number; maxFret: number }[] = [];
      let polygons: ShapePolygon[] = [];
      const mergedWrappedNotes = new Set<string>();

      if (fingeringPattern === "caged") {
        const shapesToRender = CAGED_SHAPES.filter((s) => cagedShapes.has(s));
        const allCoords = new Set<string>();
        const allBounds: { minFret: number; maxFret: number }[] = [];
        const allPolygons: ShapePolygon[] = [];
        for (const shape of shapesToRender) {
          const res = getCagedCoordinates(
            rootNote,
            shape,
            scaleName,
            currentTuning,
            24,
          );
          res.coordinates.forEach((c) => allCoords.add(c));
          allBounds.push(...res.bounds);
          allPolygons.push(...res.polygons);
          res.wrappedNotes.forEach((k) => mergedWrappedNotes.add(k));
        }

        coords = Array.from(allCoords);
        bounds = allBounds;
        polygons = allPolygons;
      } else if (fingeringPattern === "3nps") {
        if (npsPosition === 0) {
          coords = getScaleNotes(rootNote, scaleName);
        } else {
          const res = get3NPSCoordinates(
            rootNote,
            scaleName,
            currentTuning,
            24,
            npsPosition,
          );
          coords = res.coordinates;
          bounds = res.bounds;
        }
      } else {
        coords = getScaleNotes(rootNote, scaleName);
      }

      return {
        highlightNotes: coords,
        boxBounds: bounds,
        shapePolygons: polygons,
        wrappedNotes: mergedWrappedNotes,
      };
    }, [
      rootNote,
      scaleName,
      fingeringPattern,
      cagedShapes,
      npsPosition,
      currentTuning,
    ]);

  // Compute color notes: blue notes for blues scales, divergent notes for modal scales
  const colorNotes = useMemo(() => {
    const intervals = SCALES[scaleName];
    if (!intervals) return [];
    // Minor Blues: blue note is b5 (interval 6)
    if (scaleName === "Minor Blues") {
      const rootIdx = NOTES.indexOf(rootNote);
      return rootIdx >= 0 ? [NOTES[(rootIdx + 6) % 12]] : [];
    }
    // Major Blues: blue note is b3 (interval 3)
    if (scaleName === "Major Blues") {
      const rootIdx = NOTES.indexOf(rootNote);
      return rootIdx >= 0 ? [NOTES[(rootIdx + 3) % 12]] : [];
    }
    // Modal scales: notes that diverge from the reference major/minor
    return getDivergentNotes(rootNote, scaleName);
  }, [rootNote, scaleName]);

  const summaryNotes = useMemo(
    () => getScaleNotes(rootNote, scaleName),
    [rootNote, scaleName],
  );

  const scaleLabel = `${formatAccidental(getNoteDisplayInScale(rootNote, rootNote, SCALES[scaleName] || [], useFlats))} ${scaleName}`;

  const chordLabel = chordType
    ? `${formatAccidental(getNoteDisplay(chordRoot, chordRoot, useFlats))} ${chordType}`
    : null;

  const chordSummaryNotes = useMemo(() => {
    if (!chordType || chordTones.length === 0) return [];
    const chordRootIdx = NOTES.indexOf(chordRoot);
    const chordToneSet = new Set(chordTones);
    return NOTES
      .slice(chordRootIdx)
      .concat(NOTES.slice(0, chordRootIdx))
      .filter(n => chordToneSet.has(n));
  }, [chordType, chordTones, chordRoot]);

  // Summary notes content (shared between mobile Key tab and desktop summary area)
  const summaryContent = (
    <div className="summary-area">
      <div className="summary-row">
        <div className="summary-row-label">{scaleLabel}</div>
        <div className="summary-notes">
          {summaryNotes.map((n, i) => (
            <SummaryNote
              key={i}
              note={n}
              rootNote={rootNote}
              scaleName={scaleName}
              displayName={getNoteDisplayInScale(n, rootNote, SCALES[scaleName] || [], useFlats)}
            />
          ))}
        </div>
      </div>
      {chordLabel && (
        <div className="summary-row summary-row--chord">
          <div className="summary-row-label">{chordLabel}</div>
          <div className="summary-notes">
            {chordSummaryNotes.map((n, i) => (
              <SummaryNote
                key={i}
                note={n}
                rootNote={chordRoot}
                scaleName={scaleName}
                displayName={getNoteDisplay(n, chordRoot, useFlats)}
                isChord
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Mobile tab content — Key tab (CoF + accidental toggle + summary)
  const keyTabContent = (
    <div className="mobile-tab-panel mobile-key-tab">
      <div
        className="cof-container"
      >
        <CircleOfFifths
          rootNote={rootNote}
          setRootNote={handleSetRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
        />
        <button
          className="accidental-toggle cof-toggle"
          onClick={() => setUseFlats(prev => !prev)}
          title={useFlats ? 'Showing flats — click for sharps' : 'Showing sharps — click for flats'}
        >
          {useFlats ? '♭' : '♯'}
        </button>
      </div>
      {summaryContent}
    </div>
  );

  // Mobile tab content — Scale & Chord tab
  const scaleChordTabContent = (
    <div className="mobile-tab-panel mobile-scale-chord-tab">
      <ScaleChordControls
        scaleName={scaleName}
        setScaleName={setScaleName}
        chordType={chordType}
        setChordType={setChordType}
        chordRoot={chordRoot}
        setChordRoot={setChordRoot}
        linkChordRoot={linkChordRoot}
        setLinkChordRoot={setLinkChordRoot}
        hideNonChordNotes={hideNonChordNotes}
        setHideNonChordNotes={setHideNonChordNotes}
        chordIntervalFilter={chordIntervalFilter}
        setChordIntervalFilter={setChordIntervalFilter}
        rootNote={rootNote}
        useFlats={useFlats}
        scaleOptions={SCALE_OPTIONS}
        chordOptions={CHORD_OPTIONS}
        chordFilterOptions={CHORD_FILTER_OPTIONS}
      />
    </div>
  );

  // Mobile tab content — Settings tab
  const settingsTabContent = (
    <div className="mobile-tab-panel mobile-fretboard-tab">
      <FingeringPatternControls
        fingeringPattern={fingeringPattern}
        setFingeringPattern={setFingeringPattern}
        cagedShapes={cagedShapes}
        setCagedShapes={setCagedShapes}
        npsPosition={npsPosition}
        setNpsPosition={setNpsPosition}
        shapeLabels={shapeLabels}
        setShapeLabels={setShapeLabels}
        displayFormat={displayFormat}
        setDisplayFormat={setDisplayFormat}
      />

      <div className="control-section">
        <DrawerSelector
          label="Tuning"
          value={tuningName}
          options={Object.keys(TUNINGS)}
          onSelect={(v) => v && setTuningName(v)}
        />
      </div>

      {!isTabletPortrait && (
        <div className="control-section">
          <span className="section-label">Fret Range</span>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={(v) => setFretStart(v)}
            onEndChange={(v) => setFretEnd(v)}
            maxFret={END_FRET}
            layout="mobile"
          />
        </div>
      )}
      {!isTabletPortrait && (
        <div className="control-section">
          <StepperControl
            label="Zoom"
            value={fretZoom}
            onChange={(v) => setFretZoom(v)}
            min={100}
            max={300}
            step={10}
            formatValue={(z) => z <= 100 ? 'Auto' : `${z}%`}
            buttonVariant="mobile"
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container" data-layout-mode={layoutMode}>
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">
            <Music className="icon" />
          </div>
          <div className="title-container">
            <h1>FretFlow</h1>
            <p>Interactive Fretboard & Music Theory</p>
          </div>
        </div>
        <div className="header-actions">
          <a
            href="https://ko-fi.com/E1E01XFJ0G"
            target="_blank"
            rel="noopener noreferrer"
            className="kofi-header-btn"
            title="Support FretFlow on Ko-fi"
          >
            <img
              src="https://storage.ko-fi.com/cdn/brandasset/v2/support_me_on_kofi_blue.png"
              alt="Support me on Ko-fi"
              className="kofi-btn-desktop"
            />
            <img
              src="https://storage.ko-fi.com/cdn/brandasset/v2/kofi_symbol.png"
              alt="Ko-fi"
              className="kofi-btn-mobile"
            />
          </a>
          <button
            onClick={() => setSettingsOverlayOpen((v) => !v)}
            className="mute-btn"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings2 className="icon" />
          </button>
          <button
            onClick={handleReset}
            className="mute-btn"
            title="Reset to defaults"
          >
            <RotateCcw className="icon" />
          </button>
          <button
            onClick={toggleMute}
            className="mute-btn"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="icon icon-muted" />
            ) : (
              <Volume2 className="icon icon-active" />
            )}
          </button>
        </div>
      </header>

      {/* Main Fretboard */}
      <main className="main-fretboard">
        <Fretboard
          tuning={currentTuning}
          highlightNotes={highlightNotes}
          rootNote={rootNote}
          startFret={fretStart}
          endFret={fretEnd}
          boxBounds={boxBounds}
          chordTones={filteredChordTones}
          chordFretSpread={chordFretSpread}
          onChordFretSpreadChange={setChordFretSpread}
          hideNonChordNotes={hideNonChordNotes}
          colorNotes={colorNotes}
          displayFormat={displayFormat}
          shapePolygons={shapePolygons}
          shapeLabels={shapeLabels}
          fretZoom={fretZoom}
          onZoomChange={setFretZoom}
          onFretStartChange={setFretStart}
          onFretEndChange={setFretEnd}
          maxFret={END_FRET}
          wrappedNotes={wrappedNotes}
          useFlats={useFlats}
          scaleName={scaleName}
          stringRowPx={stringRowPx}
        />
      </main>

      {/* Tablet-portrait two-column panel: Settings/Scales tabs (left) + CoF (right) */}
      {isTabletPortrait && (
        <TabletPortraitPanel
          tabletTab={tabletTab}
          setTabletTab={setTabletTab}
          settingsTabContent={settingsTabContent}
          scaleChordTabContent={scaleChordTabContent}
          rootNote={rootNote}
          setRootNote={handleSetRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
          setUseFlats={(flats) => setUseFlats(flats)}
        />
      )}

      {/* Controls Panel — Target A layout when the viewport has room */}
      {isDesktopExpanded && <ExpandedControlsPanel />}

      {/* Summary bar — desktop and tablet-portrait (mobile shows it in Key tab) */}
      {(!isMobile || isTabletPortrait) && summaryContent}

      {/* Mobile inline tab bar + content — hidden on desktop */}
      {isMobile && (
        <MobileTabPanel
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          keyTabContent={keyTabContent}
          scaleChordTabContent={scaleChordTabContent}
          settingsTabContent={settingsTabContent}
        />
      )}

      <div className="version-badge">
        v{__APP_VERSION__}&nbsp;·&nbsp;© {new Date().getFullYear()} Isaac Cocar. Licensed under <a href="https://www.gnu.org/licenses/agpl-3.0" target="_blank" rel="noopener noreferrer">AGPL v3</a>.
      </div>

      <SettingsOverlay />
    </div>
  );
}

// Wraps AppContent with a fresh Jotai store per mount.
// useState lazy initializer ensures one store per component instance:
// stable across re-renders, isolated between mounts (e.g. in tests).
function App() {
  const [store] = useState(() => createStore());
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
