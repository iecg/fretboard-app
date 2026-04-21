import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useSetAtom, useAtomValue, createStore, Provider } from "jotai";
import clsx from "clsx";
import { Fretboard } from "./Fretboard";
import { HelpCircle, Settings2, Volume2, VolumeX } from "lucide-react";
import { synth } from "./audio";
import {
  isMutedAtom,
  settingsOverlayOpenAtom,
  toggleMuteAtom,
  chordTypeAtom,
  mobileTabAtom,
  showChordPracticeBarAtom,
} from "./store/atoms";
import useLayoutMode from "./hooks/useLayoutMode";
import { AppHeader } from "./components/AppHeader";
import { BrandMark } from "./components/BrandMark";
import { FretFlowWordmark } from "./components/FretFlowWordmark";
import { SummaryRibbon } from "./components/SummaryRibbon";
import { ChordOverlayDock } from "./components/ChordOverlayDock";
import { VersionBadge } from "./components/VersionBadge";
import { MainLayoutWrapper } from "./components/MainLayoutWrapper";
import sharedStyles from "./components/shared.module.css";
import "./App.css";

// Lazy-loaded components
const ExpandedControlsPanel = lazy(() =>
  import("./components/ExpandedControlsPanel").then((m) => ({
    default: m.ExpandedControlsPanel,
  }))
);
const SettingsOverlay = lazy(() => import("./components/SettingsOverlay"));
const HelpModal = lazy(() =>
  import("./components/HelpModal").then((m) => ({ default: m.HelpModal }))
);
const MobileTabPanel = lazy(() =>
  import("./components/MobileTabPanel").then((m) => ({
    default: m.MobileTabPanel,
  }))
);

function AppContent() {
  const chordType = useAtomValue(chordTypeAtom);
  const isMuted = useAtomValue(isMutedAtom);
  const showChordPracticeBar = useAtomValue(showChordPracticeBarAtom);
  // Mount mobileTabAtom so atomWithStorage writes its default to localStorage
  // on first render — required for correct initial tab state across layout modes.
  useAtomValue(mobileTabAtom);
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);
  const toggleMute = useSetAtom(toggleMuteAtom);

  const [showHelp, setShowHelp] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const layout = useLayoutMode();

  // Sync mute state to audio synth (runs on mount and whenever isMuted changes)
  useEffect(() => {
    synth.setMute(isMuted);
  }, [isMuted]);

  const versionBadge = <VersionBadge />;

  return (
    <MainLayoutWrapper
      layoutTier={layout.tier}
      layoutVariant={layout.variant}
      isChordActive={!!chordType}
      showSummary={layout.showSummary}
      showChordDock={showChordPracticeBar}
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
                className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--lg"])}
                title="Settings"
                aria-label="Open settings"
              >
                <Settings2 className="icon" />
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--lg"])}
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
                className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--lg"])}
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
      chordDock={<ChordOverlayDock />}
      helpModal={
        <Suspense fallback={<div className="loading-spinner" />}>
          <HelpModal
            isOpen={showHelp}
            onClose={() => setShowHelp(false)}
            triggerRef={helpTriggerRef}
          />
        </Suspense>
      }
      controlsPanel={
        <Suspense fallback={<div className="loading-spinner" />}>
          <ExpandedControlsPanel mode={layout.panelMode} />
        </Suspense>
      }
      mobileTabs={
        <Suspense fallback={<div className="loading-spinner" />}>
          <MobileTabPanel />
        </Suspense>
      }
      versionBadge={versionBadge}
      settingsOverlay={
        <Suspense fallback={<div className="loading-spinner" />}>
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
