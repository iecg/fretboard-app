import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import {
  settingsOverlayOpenAtom,
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  tuningNameAtom,
  chordFretSpreadAtom,
} from "../../store/atoms";
import {
  getResponsiveLayout,
  getResponsiveTier,
  type ResponsiveTier,
} from "../../layout/responsive";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  ANIMATION_DURATION_STANDARD,
  ANIMATION_EASE,
} from "../../core/constants";
import {
  SETTINGS_SECTIONS,
} from "./constants";
import { OverlaySection } from "./shared";
import { useHelpPopover } from "./useHelpPopover";
import { ViewSettingsSection } from "./sections/ViewSettingsSection";
import { InstrumentSettingsSection } from "./sections/InstrumentSettingsSection";
import { NotationSettingsSection } from "./sections/NotationSettingsSection";
import { ChordLayoutSettingsSection } from "./sections/ChordLayoutSettingsSection";
import { ResetSettingsSection } from "./sections/ResetSettingsSection";
import styles from "./SettingsOverlay.module.css";
import sharedStyles from "../shared/shared.module.css";

const getLayoutTier = (): ResponsiveTier => {
  if (typeof window === "undefined") return "desktop";
  return getResponsiveTier(window.innerWidth);
};

function getViewportSnapshot() {
  if (typeof window === "undefined") {
    return { width: 1440, height: 900 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function SettingsOverlaySurface({
  layout,
  setIsOpen,
}: {
  layout: ReturnType<typeof getResponsiveLayout>;
  setIsOpen: (value: boolean) => void;
}) {
  const {
    activeHelpField,
    activeHelpFieldRef,
    registerHelpContainer,
    setActiveHelpField,
    handleHelpToggle,
  } = useHelpPopover();

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);

  /* Trap focus inside drawer. */
  useFocusTrap({
    containerRef: drawerRef,
    active: true,
    onEscape: () => {
      if (activeHelpFieldRef.current) {
        setActiveHelpField(null);
      } else {
        setIsOpen(false);
      }
    },
    restoreFocusRef: triggerRef,
  });

  return (
    <>
      <motion.div
        className={styles["settings-overlay-backdrop"]}
        onClick={close}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: ANIMATION_DURATION_STANDARD, ease: ANIMATION_EASE }}
      />
      <motion.div
        className={styles["settings-overlay-drawer"]}
        data-testid="settings-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-layout-tier={layout.tier}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: ANIMATION_DURATION_STANDARD, ease: ANIMATION_EASE }}
      >
        <div className={styles["settings-overlay-header"]}>
          <span className={styles["settings-overlay-title"]}>Settings</span>
          <button
            type="button"
            ref={closeButtonRef}
            className={clsx(sharedStyles["icon-button"], styles["settings-overlay-close"])}
            onClick={close}
            aria-label="Close settings"
          >
            <X className="icon" />
          </button>
        </div>
        <div className={clsx(styles["settings-overlay-content"], "custom-scrollbar")}>
          {SETTINGS_SECTIONS.map((section) => {
            if (section.id === "notation") {
              return (
                <NotationSettingsSection
                  key={section.id}
                  activeHelpField={activeHelpField}
                  handleHelpToggle={handleHelpToggle}
                  registerHelpContainer={registerHelpContainer}
                />
              );
            }
            if (section.id === "chord-layout") {
              return (
                <ChordLayoutSettingsSection
                  key={section.id}
                  activeHelpField={activeHelpField}
                  handleHelpToggle={handleHelpToggle}
                  registerHelpContainer={registerHelpContainer}
                />
              );
            }
            return (
              <OverlaySection
                key={section.id}
                id={section.id}
                title={section.title}
                tone={section.tone}
              >
                {section.id === "reset" ? (
                  <ResetSettingsSection onClose={close} />
                ) : section.id === "view" ? (
                  <ViewSettingsSection />
                ) : section.id === "instrument" ? (
                  <InstrumentSettingsSection />
                ) : null}
              </OverlaySection>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

export default function SettingsOverlay() {
  const [isOpen, setIsOpen] = useAtom(settingsOverlayOpenAtom);
  const [viewport, setViewport] = useState(getViewportSnapshot);
  const openTierRef = useRef<ResponsiveTier | null>(null);
  const layout = getResponsiveLayout(viewport.width, viewport.height);

  useAtomValue(fretZoomAtom);
  useAtomValue(fretStartAtom);
  useAtomValue(fretEndAtom);
  useAtomValue(tuningNameAtom);
  useAtomValue(chordFretSpreadAtom);

  useEffect(() => {
    const onResize = () => setViewport(getViewportSnapshot());
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    openTierRef.current = isOpen ? getLayoutTier() : null;
  }, [isOpen]);

  /* Close on tier change (e.g. rotation). */
  useEffect(() => {
    if (!isOpen || !openTierRef.current) return;
    if (layout.tier !== openTierRef.current) {
      setIsOpen(false);
    }
  }, [isOpen, layout.tier, setIsOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <SettingsOverlaySurface layout={layout} setIsOpen={setIsOpen} />
      ) : null}
    </AnimatePresence>
  );
}
