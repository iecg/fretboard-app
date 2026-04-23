import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useSetAtom, useAtomValue, createStore, Provider } from "jotai";
import clsx from "clsx";
import { Fretboard } from "./components/Fretboard/Fretboard";
import { HelpCircle, Settings2, Volume2, VolumeX } from "lucide-react";
import { synth } from "./core/audio";
import {
  isMutedAtom,
  settingsOverlayOpenAtom,
  toggleMuteAtom,
  chordTypeAtom,
  mobileTabAtom,
  showChordPracticeBarAtom,
} from "./store/atoms";
import useLayoutMode from "./hooks/useLayoutMode";
import { useResolvedTheme } from "./hooks/useResolvedTheme";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { BrandMark } from "./components/BrandMark/BrandMark";
import { FretFlowWordmark } from "./components/FretFlowWordmark/FretFlowWordmark";
import { SummaryRibbon } from "./components/SummaryRibbon/SummaryRibbon";
import { ChordOverlayDock } from "./components/ChordOverlayDock/ChordOverlayDock";
import { VersionBadge } from "./components/VersionBadge/VersionBadge";
import { MainLayoutWrapper } from "./components/MainLayoutWrapper/MainLayoutWrapper";
import sharedStyles from "./components/shared/shared.module.css";
import "./styles/App.css";

const ExpandedControlsPanel = lazy(() =>
  import("./components/ExpandedControlsPanel/ExpandedControlsPanel").then((m) => ({
    default: m.ExpandedControlsPanel,
  }))
);
const SettingsOverlay = lazy(() => import("./components/SettingsOverlay/SettingsOverlay"));
const HelpModal = lazy(() =>
  import("./components/HelpModal/HelpModal").then((m) => ({ default: m.HelpModal }))
);
const MobileTabPanel = lazy(() =>
  import("./components/MobileTabPanel/MobileTabPanel").then((m) => ({
    default: m.MobileTabPanel,
  }))
);

function AppContent() {
  const chordType = useAtomValue(chordTypeAtom);
  const isMuted = useAtomValue(isMutedAtom);
  const showChordPracticeBar = useAtomValue(showChordPracticeBarAtom);
  // Mount mobileTabAtom to ensure atomWithStorage persists default state on first render.
  useAtomValue(mobileTabAtom);
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);
  const toggleMute = useSetAtom(toggleMuteAtom);

  const [showHelp, setShowHelp] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const layout = useLayoutMode();
  const theme = useResolvedTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    synth.setMute(isMuted);
  }, [isMuted]);

  const versionBadge = <VersionBadge />;

  return (
    <MainLayoutWrapper
      layoutTier={layout.tier}
      layoutVariant={layout.variant}
      theme={theme}
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
                  <Volume2 className="icon" />
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

// Use isolated Jotai store per mount for stability and test isolation.
function App() {
  const [store] = useState(() => createStore());
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
