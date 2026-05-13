import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
import { useSetAtom, useAtomValue, useAtom, createStore, Provider } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { Fretboard } from "./components/Fretboard/Fretboard";
import { HelpCircle, Music2, ListMusic, Layers, Layout, Compass, Settings2, Volume2, VolumeX } from "lucide-react";
import { synth } from "./core/audio";
import {
  isMutedAtom,
  settingsOverlayOpenAtom,
  toggleMuteAtom,
  chordRootAtom,
  chordTypeAtom,
  rootNoteAtom,
  scaleNameAtom,
  chordOverlayHiddenAtom,
  mobileTabAtom,
  audioErrorAtom,
} from "./store/atoms";
import audioErrorStyles from "./components/AudioErrorBanner/AudioErrorBanner.module.css";
import { BottomTabBar, type BottomTabItem } from "./components/BottomTabBar/BottomTabBar";
import { TAB_LABELS } from "./constants/tabLabels";
import useLayoutMode from "./hooks/useLayoutMode";
import { useResolvedTheme } from "./hooks/useResolvedTheme";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { BrandMark } from "./components/BrandMark/BrandMark";
import { FretFlowWordmark } from "./components/FretFlowWordmark/FretFlowWordmark";
import { MainLayoutWrapper } from "./components/MainLayoutWrapper/MainLayoutWrapper";
import { ProgressionSummarySlot } from "./components/ProgressionSummarySlot/ProgressionSummarySlot";
import { SettingsTooltip } from "./components/SettingsTooltip/SettingsTooltip";
import sharedStyles from "./components/shared/shared.module.css";
import { ControlsPanelSkeleton, MobileTabSkeleton } from "./components/LoadingSkeleton/LoadingSkeleton";
import { ANIMATION_DURATION_XFADE } from "@fretflow/core";
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
const NoteColorAudit = lazy(() =>
  import("./components/NoteColorAudit/NoteColorAudit").then((m) => ({
    default: m.NoteColorAudit,
  }))
);

const MOBILE_TAB_ITEMS: BottomTabItem[] = [
  { id: "scales", label: TAB_LABELS.scales, icon: <Music2 size={18} /> },
  { id: "chords", label: TAB_LABELS.chords, icon: <Layers size={18} /> },
  { id: "progression", label: TAB_LABELS.progression, icon: <ListMusic size={18} /> },
  { id: "cof", label: TAB_LABELS.cof, icon: <Compass size={18} /> },
  { id: "view", label: TAB_LABELS.view, icon: <Layout size={18} /> },
];

function AppContent() {
  const chordType = useAtomValue(chordTypeAtom);
  const isMuted = useAtomValue(isMutedAtom);
  const [mobileTab, setMobileTab] = useAtom(mobileTabAtom);
  const [settingsOverlayOpen, setSettingsOverlayOpen] = useAtom(settingsOverlayOpenAtom);
  const toggleMute = useSetAtom(toggleMuteAtom);
  const chordRoot = useAtomValue(chordRootAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const setChordOverlayHidden = useSetAtom(chordOverlayHiddenAtom);
  const [audioError, setAudioError] = useAtom(audioErrorAtom);

  const [showHelp, setShowHelp] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const layout = useLayoutMode();
  const theme = useResolvedTheme();
  // Debug mode: visiting `?audit=note-colors` swaps the entire app for the
  // NoteColorAudit harness (and clears `data-theme` so both light/dark swatches
  // can be inspected side-by-side). See "Debug modes" in CLAUDE.md.
  const showNoteColorAudit =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("audit") === "note-colors";

  useLayoutEffect(() => {
    if (showNoteColorAudit) {
      const previousTheme = document.documentElement.getAttribute("data-theme");
      document.documentElement.removeAttribute("data-theme");
      return () => {
        if (previousTheme) document.documentElement.setAttribute("data-theme", previousTheme);
        else document.documentElement.removeAttribute("data-theme");
      };
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [showNoteColorAudit, theme]);

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
    if (showNoteColorAudit) return;
    if (!overlayResetReadyRef.current) return;
    setChordOverlayHidden(false);
  }, [chordRoot, chordType, rootNote, scaleName, setChordOverlayHidden, showNoteColorAudit]);

  if (showNoteColorAudit) {
    return (
      <Suspense fallback={null}>
        <NoteColorAudit />
      </Suspense>
    );
  }

  return (
  <>
    {/* Portrait lock — CSS-only, shown via @media orientation:landscape on mobile */}
    <div className="rotate-overlay" role="alert" aria-live="polite">
      <div className="rotate-overlay-content">
        <svg className="rotate-overlay-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
        <p className="rotate-overlay-message">Please rotate your device to portrait mode</p>
      </div>
    </div>
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
              <SettingsTooltip>
                <button
                  type="button"
                  onClick={() => setSettingsOverlayOpen((v) => !v)}
                  className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--lg"])}
                  title="Settings"
                  aria-label="Open settings"
                >
                  <Settings2 className="icon" />
                </button>
              </SettingsTooltip>
              <button
                type="button"
                onClick={toggleMute}
                className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--lg"])}
                title={isMuted ? "Unmute" : "Mute"}
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
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
      summary={<ProgressionSummarySlot />}
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
          <ExpandedControlsPanel mode={layout.panelMode} />
        </Suspense>
      }
      mobileTabs={
        <Suspense fallback={<MobileTabSkeleton />}>
          <MobileTabPanel />
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
    {layout.showMobileTabs && !settingsOverlayOpen && (
      <BottomTabBar
        items={MOBILE_TAB_ITEMS}
        activeId={mobileTab}
        onSelect={(id) => setMobileTab(id as "scales" | "chords" | "cof" | "view")}
        aria-label="Mobile navigation"
      />
    )}
    {audioError && (
      <div role="alert" className={audioErrorStyles.banner}>
        <span className={audioErrorStyles.message}>{audioError}</span>
        <button
          type="button"
          className={audioErrorStyles.dismiss}
          onClick={() => setAudioError(null)}
          aria-label="Dismiss audio error notification"
        >
          Dismiss
        </button>
      </div>
    )}
  </>
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
