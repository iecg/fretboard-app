import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { settingsOverlayOpenAtom } from "../../store/uiAtoms";
import {
  getResponsiveLayout,
  getResponsiveTier,
  type ResponsiveTier,
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

export default function SettingsOverlay() {
  const [isOpen, setIsOpen] = useAtom(settingsOverlayOpenAtom);
  const [viewport, setViewport] = useState(getViewportSnapshot);
  const openTierRef = useRef<ResponsiveTier | null>(null);
  const layout = getResponsiveLayout(viewport.width, viewport.height);
  const { t } = useTranslation();

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
                  <OverlaySection id="display" title={t("settings.sections.display")}>
                    <DisplaySettingsSection />
                  </OverlaySection>
                  <OverlaySection id="instrument" title={t("settings.sections.instrument")}>
                    <InstrumentSettingsSection />
                  </OverlaySection>
                  <LanguageSettingsSection />
                  <AppearanceSettingsSection />
                  <OverlaySection id="reset" title={t("settings.sections.reset")} tone="danger">
                    <ResetSettingsSection onClose={() => setIsOpen(false)} />
                  </OverlaySection>
                  <VersionBadge />
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
