import { lazy, Suspense } from "react";
import { useAtom } from "jotai";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { mobilePanelAtom } from "../../store/uiAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import useLayoutMode from "../../hooks/useLayoutMode";
import sharedStyles from "../shared/shared.module.css";
import styles from "./MobilePanels.module.css";

// Code-split: SongControls is the heaviest control subtree; load on first open.
const SongControls = lazy(() =>
  import("../SongControls/SongControls").then((m) => ({ default: m.SongControls })),
);

/**
 * Full-screen Song setup panel. A genuine modal (Radix Dialog): focus trap,
 * Escape, focus restore to the dock toggle, and aria-hiding of the background
 * all come for free — and are *correct* here, unlike the old always-open
 * sheet. AnimatePresence + forceMount is the standard Radix exit-animation
 * pattern.
 */
export function MobileSongPanel() {
  const { t } = useTranslation();
  const [panel, setPanel] = useAtom(mobilePanelAtom);
  const open = panel === "song";
  // The portal escapes the MobileShell root that carries the layout
  // attributes — re-stamp the real tier/variant so tier-scoped CSS (touch
  // targets, SongControls mobile rules) applies inside the panel.
  const { tier, variant } = useLayoutMode();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setPanel("none");
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className={styles.songPanel}
                data-testid="mobile-song-panel"
                data-layout-tier={tier}
                data-layout-variant={variant}
                data-placement="sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.32, ease: "easeOut" }}
              >
                <header className={styles.panelHeader}>
                  <Dialog.Title className={styles.panelTitle}>
                    {t("inspector.songTab")}
                  </Dialog.Title>
                  <Dialog.Close
                    className={sharedStyles["icon-button"]}
                    data-testid="song-panel-close"
                    aria-label={t("mobilePanels.closeSong")}
                  >
                    <X className="icon" aria-hidden="true" />
                  </Dialog.Close>
                </header>
                <div className={styles.panelBody}>
                  <Suspense fallback={null}>
                    <SongControls />
                  </Suspense>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
