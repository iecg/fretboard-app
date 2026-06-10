import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
import { useAtomValue, useAtom, createStore, Provider } from "jotai";
import { Fretboard } from "./components/Fretboard/Fretboard";
import {
  resumeGuitarAudio,
  setGuitarAudioErrorHandler,
  setGuitarOutputWedgedHandler,
  setGuitarMutePreference,
  prefetchAudioModule,
} from "./core/lazyGuitarAudio";
import { probeOutputHealth } from "./core/audioOutputHealth";
import { isMutedAtom, audioErrorAtom, audioOutputWedgedAtom } from "./store/audioAtoms";
import { chordTypeAtom } from "./store/chordOverlayAtoms";
import audioErrorStyles from "./components/AudioErrorBanner/AudioErrorBanner.module.css";
import useLayoutMode from "./hooks/useLayoutMode";
import { useResolvedTheme } from "./hooks/useResolvedTheme";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useMediaSession } from "./hooks/useMediaSession";
import { useTranslation } from "./hooks/useTranslation";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { HeaderTransportCluster } from "./components/HeaderTransportCluster/HeaderTransportCluster";
import { BrandMark } from "./components/BrandMark/BrandMark";
import { FretFlowWordmark } from "./components/FretFlowWordmark/FretFlowWordmark";
import { ProgressionSummarySlot } from "./components/ProgressionSummarySlot/ProgressionSummarySlot";
import { MainLayoutWrapper } from "./components/MainLayoutWrapper/MainLayoutWrapper";
import { MobileShell } from "./components/MobileShell/MobileShell";
import { MobileSheet } from "./components/MobileShell/MobileSheet";
import { SheetPeekTransport } from "./components/MobileShell/SheetPeekTransport";

import { AppHeaderActions } from "./components/AppHeaderActions/AppHeaderActions";
import { TooltipProvider } from "./components/Tooltip/Tooltip";
import { ControlsPanelSkeleton } from "./components/LoadingSkeleton/LoadingSkeleton";
import { AppMotionConfig } from "./components/AppMotionConfig/AppMotionConfig";
import "./styles/App.css";

const SettingsOverlay = lazy(() => import("./components/SettingsOverlay/SettingsOverlay"));
const HelpModal = lazy(() =>
  import("./components/HelpModal/HelpModal").then((m) => ({ default: m.HelpModal }))
);
const Inspector = lazy(() =>
  import("./components/Inspector/Inspector").then((m) => ({ default: m.Inspector }))
);
const StatusBar = lazy(() =>
  import("./components/StatusBar/StatusBar").then((m) => ({ default: m.StatusBar }))
);


function AppContent() {
  const { t } = useTranslation();

  const chordType = useAtomValue(chordTypeAtom);
  const isMuted = useAtomValue(isMutedAtom);
  const [audioError, setAudioError] = useAtom(audioErrorAtom);
  const [audioOutputWedged, setAudioOutputWedged] = useAtom(audioOutputWedgedAtom);

  const [showHelp, setShowHelp] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const layout = useLayoutMode();
  const theme = useResolvedTheme();
  useKeyboardShortcuts();
  useMediaSession();

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    setGuitarMutePreference(isMuted);
  }, [isMuted]);

  useEffect(() => {
    setGuitarAudioErrorHandler((msg) => setAudioError(msg));
    return () => {
      setGuitarAudioErrorHandler(undefined);
    };
  }, [setAudioError]);

  // Safari "dead Web Audio output" wedge: a played note can reveal that the
  // context is running but no sound reaches the speakers (see
  // core/audioOutputHealth). It survives reload — only a full browser restart
  // recovers it — so we surface a guidance banner rather than fail silently.
  useEffect(() => {
    setGuitarOutputWedgedHandler(() => setAudioOutputWedged(true));
    return () => {
      setGuitarOutputWedgedHandler(undefined);
    };
  }, [setAudioOutputWedged]);

  // An output-device change (e.g. AirPods handing off phone → Mac) is a prime
  // trigger for the wedge. Probe after a settle delay; flag it if output is dead.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const onDeviceChange = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        void probeOutputHealth()
          .then((health) => {
            if (health === "wedged") setAudioOutputWedged(true);
          })
          .catch(() => {});
      }, 600);
    };
    md.addEventListener("devicechange", onDeviceChange);
    return () => {
      clearTimeout(settleTimer);
      md.removeEventListener("devicechange", onDeviceChange);
    };
  }, [setAudioOutputWedged]);

  useEffect(() => {
    const prefetchAll = () => {
      prefetchAudioModule();
      // Warm the Tone.js progression engine module cache so first play does
      // not wait for the full dynamic-import cascade at click time.
      void import("./progressions/audio/progressionAudioEngine");
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(prefetchAll);
    } else {
      setTimeout(prefetchAll, 1000);
    }
  }, []);

  // Safari/iOS robustness: resume AudioContext on first interaction
  useEffect(() => {
    const removeGestureListeners = () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };

    const handleGesture = () => {
      void Promise.resolve(resumeGuitarAudio())
        .then(() => {
          removeGestureListeners();
        })
        .catch(() => {
          // Keep listeners installed so the next gesture can retry resume.
        });
    };
    window.addEventListener("click", handleGesture);
    window.addEventListener("touchstart", handleGesture);
    return () => {
      removeGestureListeners();
    };
  }, []);

  const headerNode = (
    <AppHeader
      brandTitle="FretFlow"
      brandWordmark={<FretFlowWordmark />}
      brandIcon={<BrandMark />}
      transport={layout.useSheetShell ? undefined : <HeaderTransportCluster />}
      actions={
        <AppHeaderActions
          variant={layout.useSheetShell ? "menu" : "buttons"}
          onShowHelp={() => setShowHelp(true)}
          helpTriggerRef={helpTriggerRef}
          settingsTriggerRef={settingsTriggerRef}
        />
      }
    />
  );

  const helpModalNode = (
    <Suspense fallback={null}>
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        triggerRef={helpTriggerRef}
      />
    </Suspense>
  );

  const settingsOverlayNode = (
    <Suspense fallback={null}>
      <SettingsOverlay triggerRef={settingsTriggerRef} />
    </Suspense>
  );

  return (
  <TooltipProvider>
  <>
    {/* Portrait-lock overlay lives inside MobileShell — the only shell that
        renders at the ≤ 767px mobile tier its show media query targets. */}
    {layout.useSheetShell ? (
      <>
        <MobileShell
          layoutTier={layout.tier}
          layoutVariant={layout.variant}
          header={headerNode}
          track={<ProgressionSummarySlot />}
          sheet={
            <MobileSheet peek={<SheetPeekTransport />}>
              <Suspense fallback={null}>
                <Inspector placement="sheet" />
              </Suspense>
            </MobileSheet>
          }
        >
          <Fretboard stringRowPx={layout.stringRowPx} />
        </MobileShell>
        {helpModalNode}
        {settingsOverlayNode}
      </>
    ) : (
      <MainLayoutWrapper
        layoutTier={layout.tier}
        layoutVariant={layout.variant}
        isChordActive={!!chordType}
        showSummary={layout.showSummary}
        showControlsPanel={layout.showControlsPanel}
        showStatusBar={layout.showStatusBar}
        header={headerNode}
        summary={
          <ProgressionSummarySlot />
        }
        statusBar={
          <Suspense fallback={null}>
            <StatusBar />
          </Suspense>
        }
        helpModal={helpModalNode}
        controlsPanel={
          <Suspense fallback={<ControlsPanelSkeleton mode={layout.panelMode} />}>
            <Inspector placement="top" />
          </Suspense>
        }
        settingsOverlay={settingsOverlayNode}
      >
        <Fretboard
          stringRowPx={layout.stringRowPx}
        />
      </MainLayoutWrapper>
    )}
    {audioError && (
      <div role="alert" className={audioErrorStyles.banner}>
        <span className={audioErrorStyles.message}>{audioError}</span>
        <button
          type="button"
          className={audioErrorStyles.dismiss}
          onClick={() => setAudioError(null)}
          aria-label={t("common.dismiss")}
        >
          {t("common.dismiss")}
        </button>
      </div>
    )}
    {audioOutputWedged && (
      <div role="alert" className={audioErrorStyles.banner}>
        <span className={audioErrorStyles.message}>{t("common.audioOutputWedged")}</span>
        <button
          type="button"
          className={audioErrorStyles.dismiss}
          onClick={() => setAudioOutputWedged(false)}
          aria-label={t("common.dismiss")}
        >
          {t("common.dismiss")}
        </button>
      </div>
    )}
  </>
  </TooltipProvider>
  );
}

// Use isolated Jotai store per mount for stability and test isolation.
function App() {
  const [store] = useState(() => createStore());
  return (
    <Provider store={store}>
      <AppMotionConfig>
        <AppContent />
      </AppMotionConfig>
    </Provider>
  );
}

export default App;
