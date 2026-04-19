import { useState, useEffect, lazy, Suspense } from "react";
import { useAtom, useSetAtom, useAtomValue, createStore, Provider } from "jotai";
import { Fretboard } from "./Fretboard";
import { HelpCircle, Settings2, Volume2, VolumeX } from "lucide-react";
import { synth } from "./audio";
import {
  isMutedAtom,
  settingsOverlayOpenAtom,
  toggleMuteAtom,
  chordTypeAtom,
  rootNoteAtom,
  setRootNoteAtom,
  scaleNameAtom,
  useFlatsAtom,
  enharmonicDisplayAtom,
  mobileTabAtom,
} from "./store/atoms";
import useLayoutMode from "./hooks/useLayoutMode";
import { AppHeader } from "./components/AppHeader";
import { BrandMark } from "./components/BrandMark";
import { FretFlowWordmark } from "./components/FretFlowWordmark";
import { SummaryRibbon } from "./components/SummaryRibbon";
import { VersionBadge } from "./components/VersionBadge";
import { MainLayoutWrapper } from "./components/MainLayoutWrapper";
import "./App.css";

// Lazy-loaded components
const CircleOfFifths = lazy(() =>
  import("./CircleOfFifths").then((m) => ({ default: m.CircleOfFifths }))
);
const FingeringPatternControls = lazy(() =>
  import("./components/FingeringPatternControls").then((m) => ({
    default: m.FingeringPatternControls,
  }))
);
const ExpandedControlsPanel = lazy(() =>
  import("./components/ExpandedControlsPanel").then((m) => ({
    default: m.ExpandedControlsPanel,
  }))
);
const SettingsOverlay = lazy(() => import("./components/SettingsOverlay"));
const HelpModal = lazy(() =>
  import("./components/HelpModal").then((m) => ({ default: m.HelpModal }))
);
const TheoryControls = lazy(() =>
  import("./components/TheoryControls").then((m) => ({
    default: m.TheoryControls,
  }))
);
const MobileTabPanel = lazy(() =>
  import("./components/MobileTabPanel").then((m) => ({
    default: m.MobileTabPanel,
  }))
);

function AppContent() {
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const chordType = useAtomValue(chordTypeAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);

  const isMuted = useAtomValue(isMutedAtom);
  const [mobileTab, setMobileTab] = useAtom(mobileTabAtom);
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);
  const toggleMute = useSetAtom(toggleMuteAtom);

  const [showHelp, setShowHelp] = useState(false);
  const layout = useLayoutMode();

  // Sync mute state to audio synth (runs on mount and whenever isMuted changes)
  useEffect(() => {
    synth.setMute(isMuted);
  }, [isMuted]);

  const mobileKeyExplorer = (
    <div className="cof-container">
      <Suspense fallback={null}>
        <CircleOfFifths
          rootNote={rootNote}
          setRootNote={setRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
          enharmonicDisplay={enharmonicDisplay}
        />
      </Suspense>
    </div>
  );

  const theoryTabContent = (
    <div className="mobile-tab-panel mobile-theory-tab">
      <Suspense fallback={null}>
        <TheoryControls keyExplorer={mobileKeyExplorer} />
      </Suspense>
    </div>
  );

  const viewTabContent = (
    <div className="mobile-tab-panel mobile-view-tab">
      <Suspense fallback={null}>
        <FingeringPatternControls />
      </Suspense>
    </div>
  );

  const versionBadge = <VersionBadge />;

  return (
    <MainLayoutWrapper
      layoutTier={layout.tier}
      layoutVariant={layout.variant}
      isChordActive={!!chordType}
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
        <Suspense fallback={null}>
          <HelpModal
            isOpen={showHelp}
            onClose={() => setShowHelp(false)}
          />
        </Suspense>
      }
      controlsPanel={
        <Suspense fallback={null}>
          <ExpandedControlsPanel mode={layout.panelMode} />
        </Suspense>
      }
      mobileTabs={
        <Suspense fallback={null}>
          <MobileTabPanel
            mobileTab={mobileTab}
            setMobileTab={setMobileTab}
            theoryTabContent={theoryTabContent}
            viewTabContent={viewTabContent}
          />
        </Suspense>
      }
      versionBadge={versionBadge}
      settingsOverlay={
        <Suspense fallback={null}>
          <SettingsOverlay />
        </Suspense>
      }
    >
      <Fretboard
        stringRowPx={layout.stringRowPx}
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
