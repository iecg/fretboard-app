import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
import clsx from "clsx";
import { useSetAtom, useAtomValue, useAtom, createStore, Provider } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { Fretboard } from "./components/Fretboard/Fretboard";
import { HelpCircle, Moon, Settings2, Sun, Volume2, VolumeX } from "lucide-react";
import {
  resumeGuitarAudio,
  setGuitarAudioErrorHandler,
  setGuitarOutputWedgedHandler,
  setGuitarMutePreference,
  prefetchAudioModule,
} from "./core/lazyGuitarAudio";
import { probeOutputHealth } from "./core/audioOutputHealth";
import { isMutedAtom, toggleMuteAtom, audioErrorAtom, audioOutputWedgedAtom } from "./store/audioAtoms";
import { chordTypeAtom } from "./store/chordOverlayAtoms";
import { settingsOverlayOpenAtom, themeAtom } from "./store/uiAtoms";
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

import { ShareButton } from "./components/ShareButton/ShareButton";
import { useShareLinkHandler } from "./hooks/useShareLinkHandler";
import { SharedLinkBanner } from "./components/SharedLinkBanner/SharedLinkBanner";
import { SettingsTooltip } from "./components/SettingsTooltip/SettingsTooltip";
import { TooltipProvider } from "./components/Tooltip/Tooltip";
import sharedStyles from "./components/shared/shared.module.css";
import { ControlsPanelSkeleton } from "./components/LoadingSkeleton/LoadingSkeleton";
import { ANIMATION_DURATION_XFADE } from "@fretflow/core";
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
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);
  const toggleMute = useSetAtom(toggleMuteAtom);
  const [audioError, setAudioError] = useAtom(audioErrorAtom);
  const [audioOutputWedged, setAudioOutputWedged] = useAtom(audioOutputWedgedAtom);

  useShareLinkHandler();
  const setTheme = useSetAtom(themeAtom);

  const [showHelp, setShowHelp] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
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

  return (
  <TooltipProvider>
  <>
    {/* Portrait lock — CSS-only, shown via @media orientation:landscape on mobile */}
    <div className="rotate-overlay" role="alert" aria-live="polite">
      <div className="rotate-overlay-content">
        <svg className="rotate-overlay-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
        <p className="rotate-overlay-message">{t("common.rotateMessage")}</p>
      </div>
    </div>
    <SharedLinkBanner />
    <MainLayoutWrapper
      layoutTier={layout.tier}
      layoutVariant={layout.variant}
      isChordActive={!!chordType}
      showSummary={layout.showSummary}
      showControlsPanel={layout.showControlsPanel}
      showMobileTabs={layout.showMobileTabs}
      showStatusBar={layout.showStatusBar}
      header={
        <AppHeader
          brandTitle="FretFlow"
          brandWordmark={<FretFlowWordmark />}
          brandIcon={<BrandMark />}
          transport={<HeaderTransportCluster />}
          actions={
            <>
              <ShareButton />
              <button
                type="button"
                onClick={() => setTheme(theme === "modern-dark" ? "light" : "dark")}
                className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
                title={theme === "modern-dark" ? t("common.themeToLight") : t("common.themeToDark")}
                aria-label={theme === "modern-dark" ? t("common.themeToLight") : t("common.themeToDark")}
              >
                {theme === "modern-dark" ? (
                  <Sun className="icon" />
                ) : (
                  <Moon className="icon" />
                )}
              </button>
              <SettingsTooltip>
                <button
                  type="button"
                  onClick={() => setSettingsOverlayOpen((v) => !v)}
                  className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
                  title={t("settings.title")}
                  aria-label={t("settings.open")}
                >
                  <Settings2 className="icon" />
                </button>
              </SettingsTooltip>
              <button
                type="button"
                onClick={toggleMute}
                className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
                title={isMuted ? t("common.unmuteTitle") : t("common.muteTitle")}
                aria-label={isMuted ? t("common.unmute") : t("common.mute")}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isMuted ? "muted" : "unmuted"}
                    initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                    transition={{ duration: ANIMATION_DURATION_XFADE }}
                    className={sharedStyles["flex-center"]}
                  >
                    {isMuted ? (
                      <VolumeX className="icon icon-muted" />
                    ) : (
                      <Volume2 className="icon icon-active" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>
              <button
                ref={helpTriggerRef}
                type="button"
                onClick={() => setShowHelp(true)}
                className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
                title={t("common.helpTitle")}
                aria-label={t("common.help")}
              >
                <HelpCircle className="icon" />
              </button>
            </>
          }
        />
      }
      summary={
        <ProgressionSummarySlot />
      }
      statusBar={
        <Suspense fallback={null}>
          <StatusBar />
        </Suspense>
      }
      helpModal={
        <Suspense fallback={null}>
          <HelpModal
            isOpen={showHelp}
            onClose={() => setShowHelp(false)}
            triggerRef={helpTriggerRef}
          />
        </Suspense>
      }
      controlsPanel={
        <Suspense fallback={<ControlsPanelSkeleton mode={layout.panelMode} />}>
          <Inspector placement="top" />
        </Suspense>
      }
      mobileTabs={
        <Suspense fallback={<ControlsPanelSkeleton mode={layout.panelMode} />}>
          <Inspector placement="bottom" />
        </Suspense>
      }
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
