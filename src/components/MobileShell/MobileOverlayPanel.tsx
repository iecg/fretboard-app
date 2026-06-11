import { lazy, Suspense } from "react";
import { useAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { mobilePanelAtom } from "../../store/uiAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import sharedStyles from "../shared/shared.module.css";
import styles from "./MobilePanels.module.css";

// Same code-split point the lazy desktop Inspector provides: the Overlay
// controls only load when the panel first opens.
const ViewTab = lazy(() =>
  import("../Inspector/ViewTab").then((m) => ({ default: m.ViewTab })),
);

/**
 * Non-modal Overlay-controls panel, anchored above the MobileDock. The board
 * stays visible (and interactive) above it — that is the panel's purpose, so
 * there is deliberately NO focus trap and NO tap-outside dismissal: closing is
 * explicit (close button, Escape, or the dock toggle).
 */
export function MobileOverlayPanel() {
  const { t } = useTranslation();
  const [panel, setPanel] = useAtom(mobilePanelAtom);
  const open = panel === "overlay";

  const close = () => {
    setPanel("none");
    // Non-modal dialog: return focus to its dock toggle by hand (a modal's
    // focus scope would do this for us).
    document.getElementById("dock-toggle-overlay")?.focus();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          id="mobile-overlay-panel"
          data-testid="mobile-overlay-panel"
          aria-labelledby="mobile-overlay-panel-title"
          data-placement="sheet"
          className={styles.overlayPanel}
          tabIndex={-1}
          // Move SR/keyboard context into the panel on open without trapping.
          ref={(node) => node?.focus({ preventScroll: true })}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <header className={styles.panelHeader}>
            <h2 id="mobile-overlay-panel-title" className={styles.panelTitle}>
              {t("inspector.viewTab")}
            </h2>
            <button
              type="button"
              className={sharedStyles["icon-button"]}
              data-testid="overlay-panel-close"
              aria-label={t("mobilePanels.closeOverlay")}
              onClick={close}
            >
              <X className="icon" aria-hidden="true" />
            </button>
          </header>
          <div className={styles.panelBody}>
            <Suspense fallback={null}>
              <ViewTab />
            </Suspense>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
