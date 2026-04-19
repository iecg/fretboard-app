import { useState, useEffect } from "react";
import { useAtom, useSetAtom, createStore, Provider } from "jotai";
import { Fretboard } from "./Fretboard";
import { HelpCircle, Settings2, Volume2, VolumeX } from "lucide-react";
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
import { MAX_FRET } from "./constants";
import { HelpModal } from "./components/HelpModal";
import { SummaryRibbon } from "./components/SummaryRibbon";
import { MainLayoutWrapper } from "./components/MainLayoutWrapper";
import "./App.css";

function AppContent() {
  const {
    rootNote,
    scaleName,
    useFlats,
    currentTuning,
    chordRoot,
    chordType,
    hideNonChordNotes,
    chordFretSpread,
    viewMode,
    enharmonicDisplay,
    setRootNote,
    activeChordTones,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    colorNotes,
    fingeringPattern,
    setFingeringPattern,
    cagedShapes,
    setCagedShapes,
    npsPosition,
    setNpsPosition,
    displayFormat,
    setDisplayFormat,
    recenterKey,
    hiddenNotes,
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
      <TheoryControls keyExplorer={mobileKeyExplorer} />
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
        displayFormat={displayFormat}
        setDisplayFormat={setDisplayFormat}
        onShapeClick={(shape) => {
          onShapeClick(shape);
          onRecenter();
        }}
      />
    </div>
  );

  const versionBadge = (
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
  );

  return (
    <MainLayoutWrapper
      layoutTier={layout.tier}
      layoutVariant={layout.variant}
      isChordActive={!!chordType}
      showHeaderSubtitle={layout.showHeaderSubtitle}
      compactHeaderActions={layout.compactHeaderActions}
      fullWidthOverlay={layout.fullWidthOverlay}
      showSummary={layout.showSummary}
      showControlsPanel={layout.showControlsPanel}
      showMobileTabs={layout.showMobileTabs}
      header={
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
      }
      summary={<SummaryRibbon />}
      helpModal={
        <HelpModal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          fullWidth={layout.fullWidthOverlay}
        />
      }
      controlsPanel={<ExpandedControlsPanel mode={layout.panelMode} />}
      mobileTabs={
        <MobileTabPanel
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          theoryTabContent={theoryTabContent}
          viewTabContent={viewTabContent}
        />
      }
      versionBadge={versionBadge}
      settingsOverlay={<SettingsOverlay />}
    >
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
        maxFret={MAX_FRET}
        wrappedNotes={wrappedNotes}
        hiddenNotes={hiddenNotes}
        useFlats={useFlats}
        scaleName={scaleName}
        stringRowPx={layout.stringRowPx}
        autoCenterTarget={autoCenterTarget}
        recenterKey={recenterKey}
      />
    </MainLayoutWrapper>
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
