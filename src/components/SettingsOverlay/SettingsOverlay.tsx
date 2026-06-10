import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { settingsOverlayOpenAtom } from "../../store/uiAtoms";
import {
  getResponsiveLayout,
} from "../../layout/responsive";
import {
  ANIMATION_DURATION_STANDARD,
  ANIMATION_EASE,
} from "@fretflow/core";
import { OverlaySection } from "./shared";
import DisplaySettingsSection from "./sections/DisplaySettingsSection";
import InstrumentSettingsSection from "./sections/InstrumentSettingsSection";
import AppearanceSettingsSection from "./sections/AppearanceSettingsSection";
import ResetSettingsSection from "./sections/ResetSettingsSection";
import LanguageSettingsSection from "./sections/LanguageSettingsSection";
import { useTranslation } from "../../hooks/useTranslation";
import { VersionBadge } from "../VersionBadge/VersionBadge";
import { AdaptiveModal } from "../shared/AdaptiveModal";
import styles from "./SettingsOverlay.module.css";
import sharedStyles from "../shared/shared.module.css";

function getViewportSnapshot() {
  if (typeof window === "undefined") {
    return { width: 1440, height: 900 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Presentation signals (tier + useSheetShell) for the *current* viewport,
 * read straight from `window`. Snapshotted at open time so a later layout
 * change that swaps the chrome closes the overlay cleanly.
 */
function getPresentationSignal(): { tier: string; useSheetShell: boolean } {
  const { width, height } = getViewportSnapshot();
  const layout = getResponsiveLayout(width, height);
  return { tier: layout.tier, useSheetShell: layout.useSheetShell };
}

/**
 * Single-source settings body — the stacked section list shared by both the
 * desktop drawer and the mobile sheet. Lives inside `settings-overlay-content`
 * (desktop) or the sheet body (mobile). `onClose` is forwarded to
 * ResetSettingsSection so the reset two-step flow can dismiss the overlay.
 */
function SettingsSections({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <OverlaySection id="display" title={t("settings.sections.display")}>
        <DisplaySettingsSection />
      </OverlaySection>
      <OverlaySection id="instrument" title={t("settings.sections.instrument")}>
        <InstrumentSettingsSection />
      </OverlaySection>
      <LanguageSettingsSection />
      <AppearanceSettingsSection />
      <OverlaySection id="reset" title={t("settings.sections.reset")} tone="danger">
        <ResetSettingsSection onClose={onClose} />
      </OverlaySection>
      <VersionBadge />
    </>
  );
}

export default function SettingsOverlay() {
  const [isOpen, setIsOpen] = useAtom(settingsOverlayOpenAtom);
  const [viewport, setViewport] = useState(getViewportSnapshot);
  const layout = getResponsiveLayout(viewport.width, viewport.height);
  /* Capture the presentation signals at open time so a layout change that
     swaps the chrome (tier change, or a useSheetShell flip such as
     tablet-split↔tablet-stacked at the same tier) closes the overlay cleanly
     rather than stranding it in the wrong shell. */
  const openSignalRef = useRef<{ tier: string; useSheetShell: boolean } | null>(
    null,
  );
  const { t } = useTranslation();

  useEffect(() => {
    const onResize = () => setViewport(getViewportSnapshot());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    openSignalRef.current = isOpen ? getPresentationSignal() : null;
  }, [isOpen]);

  /* Close on presentation change (e.g. rotation, or a useSheetShell flip). */
  useEffect(() => {
    const opened = openSignalRef.current;
    if (!isOpen || !opened) return;
    if (
      layout.tier !== opened.tier ||
      layout.useSheetShell !== opened.useSheetShell
    ) {
      setIsOpen(false);
    }
  }, [isOpen, layout.tier, layout.useSheetShell, setIsOpen]);

  /* Touch shell (mobile or tablet-split): present as a full-height
     swipe-to-dismiss sheet. The sheet provides the backdrop + drag-dismiss;
     we supply the header + body. */
  if (layout.useSheetShell) {
    return (
      <AdaptiveModal
        presentation="sheet"
        open={isOpen}
        onOpenChange={setIsOpen}
        label={t("settings.title")}
      >
        <div className={styles["settings-overlay-header"]}>
          <h2 className={styles["settings-overlay-title"]}>{t("settings.title")}</h2>
          <button
            type="button"
            className={clsx(
              sharedStyles["icon-button"],
              sharedStyles["icon-button--sm"],
              styles["settings-overlay-close"],
            )}
            aria-label={t("settings.close")}
            onClick={() => setIsOpen(false)}
          >
            <X className="icon" />
          </button>
        </div>
        <div className={clsx(styles["settings-overlay-content"], "custom-scrollbar")}>
          <SettingsSections onClose={() => setIsOpen(false)} />
        </div>
      </AdaptiveModal>
    );
  }

  /* Desktop (non-sheet shell): slide-from-right Radix Dialog drawer. */
  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <AnimatePresence>
        {isOpen ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className={styles["settings-overlay-backdrop"]}
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: ANIMATION_DURATION_STANDARD, ease: ANIMATION_EASE }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className={styles["settings-overlay-drawer"]}
                data-testid="settings-drawer"
                data-layout-tier={layout.tier}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: ANIMATION_DURATION_STANDARD, ease: ANIMATION_EASE }}
              >
                <div className={styles["settings-overlay-header"]}>
                  <Dialog.Title className={styles["settings-overlay-title"]}>
                    {t("settings.title")}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"], styles["settings-overlay-close"])}
                      aria-label={t("settings.close")}
                    >
                      <X className="icon" />
                    </button>
                  </Dialog.Close>
                </div>
                <div className={clsx(styles["settings-overlay-content"], "custom-scrollbar")}>
                  <SettingsSections onClose={() => setIsOpen(false)} />
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
