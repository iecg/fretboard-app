import { useState, useMemo, useEffect } from "react";
import clsx from "clsx";
import {
  useAtom,
  useAtomValue,
  useSetAtom,
  createStore,
  Provider,
} from "jotai";
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
  resolveAccidentalMode,
} from "./theory";
import { STANDARD_TUNING, TUNINGS } from "./guitar";
import { Music, Settings2, Volume2, VolumeX, HelpCircle } from "lucide-react";
import { synth } from "./audio";
import { CircleOfFifths } from "./CircleOfFifths";
import { DEGREE_COLORS, getDegreesForScale } from "./degrees";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  findMainShape,
  getShapeCenterFret,
  type ShapePolygon,
  type CagedShape,
} from "./shapes";
import { FingeringPatternControls } from "./components/FingeringPatternControls";
import { ScaleChordControls } from "./components/ScaleChordControls";
import { MobileTabPanel } from "./components/MobileTabPanel";
import { ExpandedControlsPanel } from "./components/ExpandedControlsPanel";
import {
  rootNoteAtom,
  scaleNameAtom,
  fretStartAtom,
  fretEndAtom,
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
  accidentalModeAtom,
  isMutedAtom,
  mobileTabAtom,
  setRootNoteAtom,
  settingsOverlayOpenAtom,
  enharmonicDisplayAtom,
} from "./store/atoms";
import SettingsOverlay from "./components/SettingsOverlay";
import useLayoutMode from "./hooks/useLayoutMode";
import "./App.css";

const END_FRET = 24;

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
  const chromaticInterval =
    rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : -1;
  const degree =
    chromaticInterval !== -1 ? INTERVAL_NAMES[chromaticInterval] : null;
  const romanNumeral =
    chromaticInterval !== -1
      ? getDegreesForScale(scaleName)[chromaticInterval]
      : undefined;
  const degreeColor = romanNumeral ? DEGREE_COLORS[romanNumeral] : undefined;
  return (
    <span
      className={`summary-note${isChord ? " summary-note--chord" : ""}`}
      style={
        degreeColor
          ? { outline: `2px solid ${degreeColor}`, outlineOffset: "-2px" }
          : undefined
      }
    >
      <span className="summary-note-name">{formatAccidental(displayName)}</span>
      {degree && (
        <span className="summary-note-degree" style={{ color: degreeColor }}>
          {formatAccidental(degree)}
        </span>
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
  const [hideNonChordNotes, setHideNonChordNotes] = useAtom(
    hideNonChordNotesAtom,
  );
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const [chordIntervalFilter, setChordIntervalFilter] = useAtom(
    chordIntervalFilterAtom,
  );

  // Fingering
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);

  // Fret range (for auto-center calculation)
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);

  // Track clicked shape for recentering
  const [clickedShape, setClickedShape] = useState<CagedShape | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  // Display
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [shapeLabels, setShapeLabels] = useAtom(shapeLabelsAtom);
  const tuningName = useAtomValue(tuningNameAtom);

  // Accidentals / Audio / Mobile tab
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const useFlats = useMemo(
    () => resolveAccidentalMode(rootNote, scaleName, accidentalMode),
    [rootNote, scaleName, accidentalMode],
  );
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);
  const [isMuted, setIsMuted] = useAtom(isMutedAtom);
  const [mobileTab, setMobileTab] = useAtom(mobileTabAtom);

  // Settings overlay (non-persisted)
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);

  // Help modal
  const [showHelp, setShowHelp] = useState(false);

  // Viewport / mobile detection (not persisted)
  const layout = useLayoutMode();
  const stringRowPx = layout.stringRowPx;

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

  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes, autoCenterTarget } =
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

      // Compute auto-center target for CAGED mode
      let autoCenterTarget: number | undefined;
      if (fingeringPattern === "caged" && polygons.length > 0) {
        // If a shape was clicked, center that specific shape
        if (clickedShape) {
          const clickedPoly = polygons.find((p) => p.shape === clickedShape);
          if (clickedPoly && !clickedPoly.truncated) {
            autoCenterTarget = getShapeCenterFret(clickedPoly);
          }
        }
        // Otherwise find the main (lowest complete) shape
        if (autoCenterTarget === undefined) {
          const mainShape = findMainShape(polygons, mergedWrappedNotes, startFret, endFret);
          if (mainShape) {
            autoCenterTarget = getShapeCenterFret(mainShape);
          }
        }
      }

      return {
        highlightNotes: coords,
        boxBounds: bounds,
        shapePolygons: polygons,
        wrappedNotes: mergedWrappedNotes,
        autoCenterTarget,
      };
    }, [
      rootNote,
      scaleName,
      fingeringPattern,
      cagedShapes,
      npsPosition,
      currentTuning,
      startFret,
      endFret,
      clickedShape,
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
    return NOTES.slice(chordRootIdx)
      .concat(NOTES.slice(0, chordRootIdx))
      .filter((n) => chordToneSet.has(n));
  }, [chordType, chordTones, chordRoot]);

  // Summary notes content shared by every non-landscape layout.
  const summaryContent = (
    <div className="summary-area panel-surface">
      <div className="summary-row">
        <div className="summary-row-label">{scaleLabel}</div>
        <div className="summary-notes">
          {summaryNotes.map((n, i) => (
            <SummaryNote
              key={i}
              note={n}
              rootNote={rootNote}
              scaleName={scaleName}
              displayName={getNoteDisplayInScale(
                n,
                rootNote,
                SCALES[scaleName] || [],
                useFlats,
              )}
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

  // Mobile tab content — Key tab
  const keyTabContent = (
    <div className="mobile-tab-panel mobile-key-tab">
      <div className="cof-container">
        <CircleOfFifths
          rootNote={rootNote}
          setRootNote={handleSetRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
          enharmonicDisplay={enharmonicDisplay}
        />
      </div>
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
        onShapeClick={(shape) => {
          setClickedShape(shape);
          setRecenterKey((k) => k + 1);
        }}
      />
    </div>
  );

  return (
    <div
      className="app-container"
      data-layout-tier={layout.tier}
      data-layout-variant={layout.variant}
      data-header-subtitle={layout.showHeaderSubtitle ? "visible" : "hidden"}
      data-header-actions={layout.compactHeaderActions ? "compact" : "default"}
      data-full-width-overlay={layout.fullWidthOverlay ? "true" : "false"}
    >
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
        <div className="header-actions" aria-label="App actions">
          <a
            href="https://ko-fi.com/E1E01XFJ0G"
            target="_blank"
            rel="noopener noreferrer"
            className="kofi-header-btn"
            title="Support FretFlow on Ko-fi"
          >
            <img
              src="/fretboard-app/support_me_on_kofi_blue.png"
              alt="Support me on Ko-fi"
              className="kofi-btn-desktop"
            />
            <img
              src="/fretboard-app/kofi_symbol.png"
              alt="Ko-fi"
              className="kofi-btn-mobile"
            />
          </a>
          <button
            type="button"
            onClick={() => setSettingsOverlayOpen((v) => !v)}
            className="header-btn"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings2 className="icon" />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="header-btn"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="icon icon-muted" />
            ) : (
              <Volume2 className="icon icon-active" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="header-btn"
            title="Help & Instructions"
            aria-label="Open help"
          >
            <HelpCircle className="icon" />
          </button>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
          <div
            className={clsx("help-modal", {
              "help-modal--full-width": layout.fullWidthOverlay,
            })}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-modal-header">
              <h2 id="help-modal-title">FretFlow Help</h2>
              <button
                type="button"
                className="help-modal-close"
                onClick={() => setShowHelp(false)}
                title="Close help"
                aria-label="Close help"
              >
                ×
              </button>
            </div>
            <div className="help-modal-content">
              <h3>Getting Started</h3>
              <p>FretFlow is an interactive guitar fretboard and music theory tool. Use the controls below to explore scales, chords, and fingering patterns.</p>

              <h3>Basic Usage</h3>
              <ul>
                <li><strong>Scale Selection:</strong> Choose a root note and scale type to highlight notes on the fretboard</li>
                <li><strong>Chord Overlay:</strong> Select a chord to see which scale notes are chord tones</li>
                <li><strong>Fret Range:</strong> Adjust which frets are visible</li>
              </ul>

              <h3>Controls</h3>
              <ul>
                <li><strong>Reset:</strong> Return all settings to defaults</li>
                <li><strong>Mute:</strong> Toggle audio feedback when clicking notes</li>
                <li><strong>Settings:</strong> Coming soon - additional preferences</li>
              </ul>

              <h3>Tips</h3>
              <ul>
                <li>Click on fretboard notes to hear them (when unmuted)</li>
                <li>Use the Circle of Fifths widget for key relationships</li>
                <li>Try different fingering patterns to find comfortable positions</li>
                <li>Chord overlays help identify chord tones within scales</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Fretboard */}
      <main className="main-fretboard">
        <Fretboard
          tuning={currentTuning}
          highlightNotes={highlightNotes}
          rootNote={rootNote}
          boxBounds={boxBounds}
          chordTones={filteredChordTones}
          chordFretSpread={chordFretSpread}
          hideNonChordNotes={hideNonChordNotes}
          colorNotes={colorNotes}
          displayFormat={displayFormat}
          shapePolygons={shapePolygons}
          shapeLabels={shapeLabels}
          maxFret={END_FRET}
          wrappedNotes={wrappedNotes}
          useFlats={useFlats}
          scaleName={scaleName}
          stringRowPx={stringRowPx}
          autoCenterTarget={autoCenterTarget}
          recenterKey={recenterKey}
        />
      </main>

      {/* Shared tablet/desktop controls panel */}
      {layout.showControlsPanel && (
        <ExpandedControlsPanel mode={layout.isSplitPanel ? "split" : "stacked"} />
      )}

      {/* Mobile inline tab bar + content — hidden on desktop */}
      {layout.showMobileTabs && (
        <MobileTabPanel
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          keyTabContent={keyTabContent}
          scaleChordTabContent={scaleChordTabContent}
          settingsTabContent={settingsTabContent}
        />
      )}

      {layout.showSummary && summaryContent}

      <div className="version-badge">
        v{__APP_VERSION__}&nbsp;·&nbsp;© {new Date().getFullYear()} Isaac Cocar.
        Licensed under{" "}
        <a
          href="https://www.gnu.org/licenses/agpl-3.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          AGPL v3
        </a>
        .
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
