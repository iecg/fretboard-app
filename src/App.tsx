import { useState, useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import { useAtom, useSetAtom, createStore, Provider } from "jotai";
import { Fretboard } from "./Fretboard";
import {
  SCALES,
  NOTES,
  INTERVAL_NAMES,
  getNoteDisplayInScale,
  formatAccidental,
} from "./theory";
import { HelpCircle, Settings2, Volume2, VolumeX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { getFocusableElements } from "./utils/dom";
import { synth } from "./audio";
import { CircleOfFifths } from "./CircleOfFifths";
import { FingeringPatternControls } from "./components/FingeringPatternControls";
import { TheoryControls } from "./components/TheoryControls";
import { MobileTabPanel } from "./components/MobileTabPanel";
import { ExpandedControlsPanel } from "./components/ExpandedControlsPanel";
import {
  isMutedAtom,
  mobileTabAtom,
  settingsOverlayOpenAtom,
} from "./store/atoms";
import SettingsOverlay from "./components/SettingsOverlay";
import useLayoutMode from "./hooks/useLayoutMode";
import useDisplayState from "./hooks/useDisplayState";
import { AppHeader } from "./components/AppHeader";
import { BrandMark } from "./components/BrandMark";
import { FretFlowWordmark } from "./components/FretFlowWordmark";
import { DegreeChipStrip } from "./components/DegreeChipStrip";
import "./App.css";

const END_FRET = 25;

function AppContent() {
  const {
    rootNote,
    scaleName,
    setScaleName,
    scaleBrowseMode,
    setScaleBrowseMode,
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
    chordSummaryNotes,
    recenterKey,
    onShapeClick,
    onRecenter,
  } = useDisplayState();

  const [isMuted, setIsMuted] = useAtom(isMutedAtom);
  const [mobileTab, setMobileTab] = useAtom(mobileTabAtom);
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);

  const [showHelp, setShowHelp] = useState(false);
  const helpModalRef = useRef<HTMLDivElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const layout = useLayoutMode();

  // Focus trap + focus restoration for help modal
  useEffect(() => {
    if (!showHelp) return;
    const modal = helpModalRef.current;
    const trigger = helpTriggerRef.current;
    const focusables = getFocusableElements(modal);
    focusables[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowHelp(false);
        return;
      }
      if (e.key !== "Tab") return;
      const els = getFocusableElements(modal);
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function handlePointerDown(e: PointerEvent) {
      const target = e.target;
      if (!(target instanceof Node) || !modal) return;
      if (!modal.contains(target)) {
        setShowHelp(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      trigger?.focus();
    };
  }, [showHelp]);

  // Sync mute state to audio synth (runs on mount and whenever isMuted changes)
  useEffect(() => {
    synth.setMute(isMuted);
  }, [isMuted]);

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    synth.setMute(nextMute);
  };

  // Build DegreeChip[] from scale/chord atoms for DegreeChipStrip
  const degreeChips = useMemo(() => {
    const rootIdx = NOTES.indexOf(rootNote);
    const chordToneSet = new Set(chordSummaryNotes);
    return summaryNotes.map((note) => {
      const noteIdx = NOTES.indexOf(note);
      const chromaticInterval =
        rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : 0;
      const interval = INTERVAL_NAMES[chromaticInterval] ?? "1";
      return {
        note: formatAccidental(
          getNoteDisplayInScale(
            note,
            rootNote,
            SCALES[scaleName] || [],
            useFlats,
          ),
        ),
        interval,
        inScale: true,
        isTonic: note === rootNote,
        inChord: chordToneSet.has(note),
      };
    });
  }, [summaryNotes, rootNote, scaleName, useFlats, chordSummaryNotes]);

  // Summary notes content shared by every non-landscape layout.
  const summaryContent = (
    <DegreeChipStrip
      scaleName={scaleLabel}
      chips={degreeChips}
      aria-label="Scale degrees"
    />
  );

  const mobileKeyExplorer = (
    <div className="cof-container">
      <CircleOfFifths
        rootNote={rootNote}
        setRootNote={setRootNote}
        scaleName={scaleName}
        useFlats={useFlats}
        enharmonicDisplay={enharmonicDisplay}
      />
    </div>
  );

  const theoryTabContent = (
    <div className="mobile-tab-panel mobile-theory-tab">
      <TheoryControls
        rootNote={rootNote}
        setRootNote={setRootNote}
        scaleName={scaleName}
        setScaleName={setScaleName}
        scaleBrowseMode={scaleBrowseMode}
        setScaleBrowseMode={setScaleBrowseMode}
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
        useFlats={useFlats}
        keyExplorer={mobileKeyExplorer}
      />
    </div>
  );

  const viewTabContent = (
    <div className="mobile-tab-panel mobile-view-tab">
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
      <AppHeader
        brandTitle="FretFlow"
        brandSubtitle="Interactive Fretboard & Music Theory"
        brandWordmark={<FretFlowWordmark />}
        brandIcon={<BrandMark />}
        actions={
          <>
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
              aria-label={isMuted ? "Unmute audio" : "Mute audio"}
            >
              {isMuted ? (
                <VolumeX className="icon icon-muted" />
              ) : (
                <Volume2 className="icon icon-active" />
              )}
            </button>
            <button
              ref={helpTriggerRef}
              type="button"
              onClick={() => setShowHelp(true)}
              className="header-btn"
              title="Help & Instructions"
              aria-label="Open help"
            >
              <HelpCircle className="icon" />
            </button>
          </>
        }
      />

      {layout.showSummary && (
        <div className="summary-shell">{summaryContent}</div>
      )}

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp ? (
          <motion.div
            className="help-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <motion.div
              ref={helpModalRef}
              className={clsx("help-modal", {
                "help-modal--full-width": layout.fullWidthOverlay,
              })}
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-modal-title"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="help-modal-header">
                <h2 id="help-modal-title">FretFlow Help</h2>
                <button
                  type="button"
                  className="help-modal-close"
                  onClick={() => setShowHelp(false)}
                  aria-label="Close help"
                >
                  <X className="icon" />
                </button>
              </div>
              <div className="help-modal-content">
                <h3>Getting Started</h3>
                <p>
                  FretFlow is an interactive guitar fretboard and music theory
                  tool. Choose a root note, scale type, and optional chord to
                  explore how notes and intervals map across a 6-string guitar
                  neck.
                </p>

                <h3>Basic Usage</h3>
                <ul>
                  <li>
                    <strong>Scale Selection:</strong> Pick a root note and scale
                    type to highlight the matching notes on the fretboard.
                  </li>
                  <li>
                    <strong>Chord Overlay:</strong> Select a chord to
                    distinguish chord tones from other scale notes. Use the
                    interval filter to narrow which chord tones appear.
                  </li>
                  <li>
                    <strong>Fingering Patterns:</strong> Enable CAGED shapes or
                    3NPS positions to see positional overlays across the neck.
                  </li>
                  <li>
                    <strong>Circle of Fifths:</strong> Tap a key segment to
                    change the root note. Degree markers show the current
                    scale's intervals relative to each key.
                  </li>
                </ul>

                <h3>Controls</h3>
                <ul>
                  <li>
                    <strong>Mute:</strong> Toggle audio feedback on note taps
                    using the speaker icon in the header.
                  </li>
                  <li>
                    <strong>Settings (gear icon):</strong> Adjust tuning, zoom,
                    fret range, accidentals, enharmonic display, and chord
                    spread. Reset all settings to defaults from Settings →
                    Reset.
                  </li>
                </ul>

                <h3>Tips</h3>
                <ul>
                  <li>Tap any fretboard note to hear it play (when unmuted).</li>
                  <li>
                    The fret range control lets you focus on any section of the
                    neck — useful for position-specific practice.
                  </li>
                  <li>
                    CAGED shapes and 3NPS positions show how the same scale maps
                    across different hand positions on the neck.
                  </li>
                  <li>
                    The degree strip below the fretboard shows the interval
                    structure of the selected scale.
                  </li>
                  <li>
                    Enable "Hide non-chord notes" in the chord overlay to focus
                    on playable chord voicings within the scale.
                  </li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
        <ExpandedControlsPanel mode={layout.panelMode} />
      )}

      {/* Mobile inline tab bar + content — hidden on desktop */}
      {layout.showMobileTabs && (
        <MobileTabPanel
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          theoryTabContent={theoryTabContent}
          viewTabContent={viewTabContent}
        />
      )}

      <div className="version-badge">
        <span className="version-text">
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
        </span>
        <a
          href="https://ko-fi.com/E1E01XFJ0G"
          target="_blank"
          rel="noopener noreferrer"
          className="kofi-badge-btn"
          title="Support FretFlow on Ko-fi"
        >
          <img
            src="/fretboard-app/kofi_symbol.png"
            alt="Ko-fi"
            className="kofi-badge-icon"
          />
        </a>
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
