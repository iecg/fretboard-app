import { useState, useEffect } from "react";
import clsx from "clsx";
import {
  useAtom,
  useSetAtom,
  createStore,
  Provider,
} from "jotai";
import { Fretboard } from "./Fretboard";
import {
  SCALES,
  NOTES,
  INTERVAL_NAMES,
  getNoteDisplay,
  getNoteDisplayInScale,
  formatAccidental,
} from "./theory";
import { Music, Settings2, Volume2, VolumeX, HelpCircle } from "lucide-react";
import { synth } from "./audio";
import { CircleOfFifths } from "./CircleOfFifths";
import { DEGREE_COLORS, getDegreesForScale } from "./degrees";
import { FingeringPatternControls } from "./components/FingeringPatternControls";
import { ScaleChordControls } from "./components/ScaleChordControls";
import { MobileTabPanel } from "./components/MobileTabPanel";
import { ExpandedControlsPanel } from "./components/ExpandedControlsPanel";
import {
  isMutedAtom,
  mobileTabAtom,
  settingsOverlayOpenAtom,
} from "./store/atoms";
import SettingsOverlay from "./components/SettingsOverlay";
import useLayoutMode from "./hooks/useLayoutMode";
import useDisplayState, { CHORD_FILTER_OPTIONS } from "./hooks/useDisplayState";
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
  const {
    rootNote,
    scaleName,
    setScaleName,
    useFlats,
    currentTuning,
    chordRoot,
    setChordRoot,
    chordType,
    setChordType,
    linkChordRoot,
    setLinkChordRoot,
    hideNonChordNotes,
    setHideNonChordNotes,
    chordFretSpread,
    chordIntervalFilter,
    setChordIntervalFilter,
    fingeringPattern,
    setFingeringPattern,
    cagedShapes,
    setCagedShapes,
    npsPosition,
    setNpsPosition,
    displayFormat,
    setDisplayFormat,
    shapeLabels,
    setShapeLabels,
    enharmonicDisplay,
    setRootNote,
    filteredChordTones,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    colorNotes,
    summaryNotes,
    scaleLabel,
    chordLabel,
    chordSummaryNotes,
    recenterKey,
    onShapeClick,
    onRecenter,
  } = useDisplayState();

  const [isMuted, setIsMuted] = useAtom(isMutedAtom);
  const [mobileTab, setMobileTab] = useAtom(mobileTabAtom);
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);

  const [showHelp, setShowHelp] = useState(false);
  const layout = useLayoutMode();

  // Sync mute state to audio synth (runs on mount and whenever isMuted changes)
  useEffect(() => {
    synth.setMute(isMuted);
  }, [isMuted]);

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    synth.setMute(nextMute);
  };

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
          setRootNote={setRootNote}
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
          onShapeClick(shape);
          onRecenter();
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
          stringRowPx={layout.stringRowPx}
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
