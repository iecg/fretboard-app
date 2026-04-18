import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { ChordRowStrip } from "./components/ChordRowStrip";
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
    chordFretSpread,
    viewMode,
    setViewMode,
    focusPreset,
    setFocusPreset,
    customMembers,
    setCustomMembers,
    availableFocusPresets,
    chordMembers,
    hasOutsideChordMembers,
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
    activeChordTones,
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
    summaryChordRow,
    summaryLegendItems,
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

  // Note visibility toggling via the degree chip strip.
  // State is keyed to rootNote+scaleName so changing scale auto-resets.
  const [hiddenNotesState, setHiddenNotesState] = useState<{
    root: string;
    scale: string;
    notes: Set<string>;
  }>({ root: rootNote, scale: scaleName, notes: new Set() });

  const hiddenNotes = useMemo(
    () =>
      hiddenNotesState.root === rootNote && hiddenNotesState.scale === scaleName
        ? hiddenNotesState.notes
        : new Set<string>(),
    [hiddenNotesState, rootNote, scaleName],
  );

  const toggleHiddenNote = useCallback(
    (note: string) => {
      setHiddenNotesState((prev) => {
        const prevNotes =
          prev.root === rootNote && prev.scale === scaleName
            ? prev.notes
            : new Set<string>();
        const next = new Set(prevNotes);
        if (next.has(note)) next.delete(note);
        else next.add(note);
        return { root: rootNote, scale: scaleName, notes: next };
      });
    },
    [rootNote, scaleName],
  );

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
        internalNote: note,
        note: formatAccidental(
          getNoteDisplayInScale(
            note,
            rootNote,
            SCALES[scaleName] || [],
            useFlats,
          ),
        ),
        interval: formatAccidental(interval),
        inScale: true,
        isTonic: note === rootNote,
        inChord: chordToneSet.has(note),
      };
    });
  }, [summaryNotes, rootNote, scaleName, useFlats, chordSummaryNotes]);

  // Summary notes content shared by every non-landscape layout.
  const summaryContent = (
    <div className="summary-overlay-stack">
      <DegreeChipStrip
        scaleName={scaleLabel}
        chips={degreeChips}
        hiddenNotes={hiddenNotes}
        onChipToggle={toggleHiddenNote}
        aria-label="Scale degrees"
      />
      {chordType && chordLabel && (
        <ChordRowStrip
          chordLabel={chordLabel}
          chordRow={summaryChordRow}
          legendItems={summaryLegendItems}
        />
      )}
    </div>
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
        viewMode={viewMode}
        setViewMode={setViewMode}
        focusPreset={focusPreset}
        setFocusPreset={setFocusPreset}
        customMembers={customMembers}
        setCustomMembers={setCustomMembers}
        availableFocusPresets={availableFocusPresets}
        chordMembers={chordMembers}
        hasOutsideChordMembers={hasOutsideChordMembers}
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
                  tool. Choose a root note, scale, and optional chord overlay to
                  visualize notes and intervals across a 6-string guitar neck.
                </p>

                <h3>Layout</h3>
                <ul>
                  <li>
                    <strong>Mobile:</strong> The fretboard fills the center of
                    the screen. A tab bar below switches between the{" "}
                    <em>Theory</em> panel (scale, chord, Circle of Fifths) and
                    the <em>View</em> panel (fingering patterns, note labels).
                  </li>
                  <li>
                    <strong>Tablet &amp; desktop:</strong> Controls appear
                    alongside the fretboard in three cards — Music Theory,
                    Configuration, and Key Explorer.
                  </li>
                </ul>

                <h3>Choosing a Scale</h3>
                <ul>
                  <li>
                    <strong>Root:</strong> Tap a note in the note grid to set
                    the tonic.
                  </li>
                  <li>
                    <strong>Scale Family:</strong> Choose a broad family
                    (Pentatonic, Diatonic, etc.) from the dropdown.
                  </li>
                  <li>
                    <strong>Mode / Scale browser:</strong> Use the arrows or
                    dropdown to step through the modes or keys within that
                    family. The <em>Parallel</em> / <em>Relative</em> toggle
                    controls whether browsing stays on the same root or cycles
                    through relative keys.
                  </li>
                </ul>

                <h3>Chord Overlay</h3>
                <ul>
                  <li>
                    Expand <strong>Chord Overlay</strong> and pick a chord type
                    to highlight chord tones on the fretboard in a distinct
                    color.
                  </li>
                  <li>
                    <strong>Link chord root to scale</strong> keeps the chord
                    root in sync with the scale root automatically.
                  </li>
                  <li>
                    <strong>Chord only (hide scale)</strong> dims non-chord
                    notes so you can focus on playable voicings.
                  </li>
                  <li>
                    <strong>Interval Filter</strong> narrows which chord tones
                    appear — useful for isolating roots, fifths, or specific
                    intervals.
                  </li>
                </ul>

                <h3>Fingering Patterns</h3>
                <ul>
                  <li>
                    <strong>All:</strong> Highlights every scale note with no
                    positional shapes.
                  </li>
                  <li>
                    <strong>CAGED:</strong> Shows overlapping position shapes
                    across the neck. Click a shape (C / A / G / E / D) to
                    isolate it; Shift-click to toggle multiple shapes. Enable{" "}
                    <em>Shape Labels</em> to letter each polygon.
                  </li>
                  <li>
                    <strong>3NPS:</strong> Shows 3-notes-per-string positions.
                    Use the position selector (1–7 or All) to isolate a single
                    hand position.
                  </li>
                </ul>

                <h3>Note Labels &amp; Degree Strip</h3>
                <ul>
                  <li>
                    The <strong>Note Labels</strong> toggle (Notes / Intervals /
                    None) controls what appears inside each fretboard dot.
                  </li>
                  <li>
                    The <strong>degree strip</strong> between the header and the
                    fretboard lists the scale's notes with their interval name
                    below each one. Chord tones are highlighted when a chord is
                    active.
                  </li>
                </ul>

                <h3>Circle of Fifths</h3>
                <p>
                  Tap any key segment to change the root note. Degree markers
                  around the circle show how the current scale's intervals
                  relate to each key. On mobile, expand it from the{" "}
                  <em>Theory</em> tab under <em>Circle of Fifths</em>.
                </p>

                <h3>Header Controls</h3>
                <ul>
                  <li>
                    <strong>Settings (gear icon):</strong> Opens a drawer for
                    Tuning, Zoom, Fret Range, Accidentals, Enharmonic Display,
                    and Chord Spread. Use Settings → Reset to restore all
                    defaults.
                  </li>
                  <li>
                    <strong>Speaker icon:</strong> Toggles audio playback. Tap
                    any fretboard dot to hear the note when unmuted.
                  </li>
                </ul>

                <h3>Tips</h3>
                <ul>
                  <li>
                    Drag or scroll the fretboard horizontally when zoomed in.
                  </li>
                  <li>
                    The fret range control (in Settings or the Configuration
                    card) lets you focus on a specific section of the neck.
                  </li>
                  <li>
                    Use CAGED or 3NPS shapes to see how the same scale maps to
                    different hand positions.
                  </li>
                  <li>
                    Switch between Parallel and Relative browsing to explore
                    related modes without leaving the current key.
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
          chordTones={activeChordTones}
          chordRoot={chordRoot}
          chordFretSpread={chordFretSpread}
          hideNonChordNotes={hideNonChordNotes}
          viewMode={viewMode}
          colorNotes={colorNotes}
          displayFormat={displayFormat}
          shapePolygons={shapePolygons}
          shapeLabels={shapeLabels}
          maxFret={END_FRET}
          wrappedNotes={wrappedNotes}
          hiddenNotes={hiddenNotes}
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
