import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
import { useSetAtom, useAtomValue, useAtom, createStore, Provider } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { Fretboard } from "./components/Fretboard/Fretboard";
import { HelpCircle, Moon, Settings2, Sun, Volume2, VolumeX } from "lucide-react";
import { synth } from "./core/audio";
import { isMutedAtom, toggleMuteAtom, audioErrorAtom } from "./store/audioAtoms";
import { chordRootAtom, chordTypeAtom, chordOverlayHiddenAtom } from "./store/chordOverlayAtoms";
import { rootNoteAtom, scaleNameAtom } from "./store/scaleAtoms";
import { settingsOverlayOpenAtom, themeAtom } from "./store/uiAtoms";
import audioErrorStyles from "./components/AudioErrorBanner/AudioErrorBanner.module.css";
import useLayoutMode from "./hooks/useLayoutMode";
import { useResolvedTheme } from "./hooks/useResolvedTheme";
import { useTranslation } from "./hooks/useTranslation";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { HeaderTransportCluster } from "./components/HeaderTransportCluster/HeaderTransportCluster";
import { BrandMark } from "./components/BrandMark/BrandMark";
import { FretFlowWordmark } from "./components/FretFlowWordmark/FretFlowWordmark";
import { Inspector } from "./components/Inspector/Inspector";
import { MainLayoutWrapper } from "./components/MainLayoutWrapper/MainLayoutWrapper";
import { StatusBar } from "./components/StatusBar/StatusBar";
import { ProgressionSummarySlot } from "./components/ProgressionSummarySlot/ProgressionSummarySlot";
import { FretboardLensOverlay } from "./components/FretboardLensOverlay/FretboardLensOverlay";
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

function AppContent() {
  const { t } = useTranslation();

  const chordType = useAtomValue(chordTypeAtom);
  const isMuted = useAtomValue(isMutedAtom);
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);
  const toggleMute = useSetAtom(toggleMuteAtom);
  const chordRoot = useAtomValue(chordRootAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const setChordOverlayHidden = useSetAtom(chordOverlayHiddenAtom);
  const [audioError, setAudioError] = useAtom(audioErrorAtom);
  const setTheme = useSetAtom(themeAtom);

  const [showHelp, setShowHelp] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const layout = useLayoutMode();
  const theme = useResolvedTheme();

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    synth.setMute(isMuted);
  }, [isMuted]);

  useEffect(() => {
    synth.onError = (msg) => setAudioError(msg);
    return () => {
      synth.onError = undefined;
    };
  }, [setAudioError]);

  // Safari/iOS robustness: resume AudioContext on first interaction
  useEffect(() => {
    const handleGesture = () => {
      void synth.resume();
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };
    window.addEventListener("click", handleGesture);
    window.addEventListener("touchstart", handleGesture);
    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };
  }, []);

  // Reset chord overlay visibility whenever chord or scale identity changes.
  // Skip resets that fire during the initial mount + atom hydration cycle so
  // that persisted hidden=true is honoured on reload. A one-tick defer via
  // setTimeout(0) lets all atomWithStorage onMount callbacks settle first;
  // only after that does the dep-change effect actually call setChordOverlayHidden.
  const overlayResetReadyRef = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => {
      overlayResetReadyRef.current = true;
    }, 0);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!overlayResetReadyRef.current) return;
    setChordOverlayHidden(false);
  }, [chordRoot, chordType, rootNote, scaleName, setChordOverlayHidden]);

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
              <button
                type="button"
                onClick={() => setTheme(theme === "modern-dark" ? "light" : "dark")}
                className={sharedStyles["icon-button"]}
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
                  className={sharedStyles["icon-button"]}
                  title={t("settings.title")}
                  aria-label={t("settings.open")}
                >
                  <Settings2 className="icon" />
                </button>
              </SettingsTooltip>
              <button
                type="button"
                onClick={toggleMute}
                className={sharedStyles["icon-button"]}
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
                className={sharedStyles["icon-button"]}
                title={t("common.helpTitle")}
                aria-label={t("common.help")}
              >
                <HelpCircle className="icon" />
              </button>
            </>
          }
        />
      }
      summary={<ProgressionSummarySlot />}
      statusBar={<StatusBar />}
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
      <FretboardLensOverlay />
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
