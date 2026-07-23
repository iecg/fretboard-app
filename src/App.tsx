import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
import { useAtomValue, useAtom, createStore, Provider } from "jotai";
import { Fretboard } from "@fretflow/fretboard/components/Fretboard/Fretboard";
import {
  resumeGuitarAudio,
  setGuitarAudioErrorHandler,
  setGuitarOutputWedgedHandler,
  setGuitarMutePreference,
  prefetchAudioModule,
} from "@fretflow/fretboard/core/lazyGuitarAudio";
import { probeOutputHealth } from "@fretflow/fretboard/core/audioOutputHealth";
import { isMutedAtom, audioErrorAtom, audioOutputWedgedAtom } from "@fretflow/fretboard/store/audioAtoms";
import { chordTypeAtom } from "@fretflow/fretboard/store/chordOverlayAtoms";
import { fretZoomAtom, stringRowPxOverrideAtom } from "@fretflow/fretboard/store/layoutAtoms";
import { scaleRowForZoomOut } from "@fretflow/fretboard/layout/responsive";

import useLayoutMode from "./hooks/useLayoutMode";
import { useResolvedTheme } from "@fretflow/fretboard/hooks/useResolvedTheme";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useMediaSession } from "./hooks/useMediaSession";
import { useTranslation } from "./hooks/useTranslation";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { HeaderTransportCluster } from "./components/HeaderTransportCluster/HeaderTransportCluster";
import { TempoReadout } from "./components/HeaderTransportCluster/TempoReadout";
import { BrandMark } from "./components/BrandMark/BrandMark";
import { FretFlowWordmark } from "./components/FretFlowWordmark/FretFlowWordmark";
import { ProgressionSummarySlot } from "./components/ProgressionSummarySlot/ProgressionSummarySlot";
import { MainLayoutWrapper } from "./components/MainLayoutWrapper/MainLayoutWrapper";
import { MobileShell } from "./components/MobileShell/MobileShell";
import { MobileDock } from "./components/MobileShell/MobileDock";
import { ShellTransport } from "./components/MobileShell/ShellTransport";
import { MobileOverlayPanel } from "./components/MobileShell/MobileOverlayPanel";
import { MobileSongPanel } from "./components/MobileShell/MobileSongPanel";

import { ShareButton } from "./components/ShareButton/ShareButton";
import { useShareLinkHandler } from "./hooks/useShareLinkHandler";
import { SharedLinkBanner } from "./components/SharedLinkBanner/SharedLinkBanner";
import { usePWAInstall } from "./hooks/usePWAInstall";
import { InstallBanner } from "./components/InstallBanner/InstallBanner";
import { AppHeaderActions } from "./components/AppHeaderActions/AppHeaderActions";
import { TooltipProvider } from "./components/Tooltip/Tooltip";
import { ControlsPanelSkeleton } from "./components/LoadingSkeleton/LoadingSkeleton";
import { MotionConfig } from "motion/react";
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
  // Sub-100 zoom on sheet shells = zoom OUT: rows (and with them the note
  // bubbles and the fret-width floor) shrink proportionally so more frets fit.
  const fretZoom = useAtomValue(fretZoomAtom);
  const stringRowPxOverride = useAtomValue(stringRowPxOverrideAtom);
  const isMuted = useAtomValue(isMutedAtom);
  const [audioError, setAudioError] = useAtom(audioErrorAtom);
  const [audioOutputWedged, setAudioOutputWedged] = useAtom(audioOutputWedgedAtom);

  useShareLinkHandler();
  const { canInstall, install, dismiss } = usePWAInstall();

  const [showHelp, setShowHelp] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const layout = useLayoutMode();
  const effectiveStringRowPx = stringRowPxOverride > 0 ? stringRowPxOverride : layout.stringRowPx;
  const rowScale = effectiveStringRowPx / layout.stringRowPx;
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
      void import("@fretflow/fretboard/progressions/audio/progressionAudioEngine");
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
      /* Sheet shell: the full transport lives in the sheet peek, so the header
         gap between brand and actions carries just the compact tempo chip. */
      transport={layout.useSheetShell ? <TempoReadout /> : <HeaderTransportCluster />}
      actions={
        <>
          <ShareButton />
          <AppHeaderActions
            variant={layout.useSheetShell ? "menu" : "buttons"}
            onShowHelp={() => setShowHelp(true)}
            helpTriggerRef={helpTriggerRef}
            settingsTriggerRef={settingsTriggerRef}
          />
        </>
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
    {/* Shared-link + PWA-install banners are global (both layouts). On the
        mobile sheet shell — a fixed inset:0 surface — they can be occluded;
        refining their placement inside the shell is a tracked follow-up. */}
    <SharedLinkBanner />
    <InstallBanner canInstall={canInstall} onInstall={install} onDismiss={dismiss} />
    {/* Portrait-lock overlay lives inside MobileShell — the only shell that
        renders at the ≤ 767px mobile tier its show media query targets. */}
    {layout.useSheetShell ? (
      <>
        <MobileShell
          layoutTier={layout.tier}
          layoutVariant={layout.variant}
          header={headerNode}
          transport={<ShellTransport />}
          track={<ProgressionSummarySlot />}
          panel={
            <>
              <MobileOverlayPanel />
              <MobileSongPanel />
            </>
          }
          dock={<MobileDock />}
        >
          <Fretboard
            stringRowPx={scaleRowForZoomOut(effectiveStringRowPx, fretZoom)}
            rowScale={rowScale}
          />
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
            <Inspector />
          </Suspense>
        }
        settingsOverlay={settingsOverlayNode}
      >
        <Fretboard
          stringRowPx={effectiveStringRowPx}
          rowScale={rowScale}
        />
      </MainLayoutWrapper>
    )}
    {audioError && (
      <div role="alert" className="audio-error-banner">
        <span className="audio-error-message">{audioError}</span>
        <button
          type="button"
          className="audio-error-dismiss"
          onClick={() => setAudioError(null)}
          aria-label={t("common.dismiss")}
        >
          {t("common.dismiss")}
        </button>
      </div>
    )}
    {audioOutputWedged && (
      <div role="alert" className="audio-error-banner">
        <span className="audio-error-message">{t("common.audioOutputWedged")}</span>
        <button
          type="button"
          className="audio-error-dismiss"
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
      <MotionConfig reducedMotion="user">
        <AppContent />
      </MotionConfig>
    </Provider>
  );
}

export default App;
