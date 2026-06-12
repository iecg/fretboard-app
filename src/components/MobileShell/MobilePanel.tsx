import { type ReactNode, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import sharedStyles from "../shared/shared.module.css";
import styles from "./MobilePanels.module.css";

interface MobilePanelProps {
  /** Which dock tab owns this panel — drives ids, testids, and height. */
  panelId: "overlay" | "song";
  open: boolean;
  /** Clear the panel atom; MobilePanel handles returning focus itself. */
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

/**
 * Shared non-modal drawer primitive for the dock panels. Both panels are the
 * same surface — anchored above the dock tab bar so the tabs stay visible and
 * switchable — and differ only in how much of the viewport they cover:
 * `overlay` leaves the board visible above it, `song` rises to just below the
 * progression track (timeline + transport stay usable while editing).
 *
 * Deliberately NO focus trap and NO tap-outside dismissal: the chrome above
 * the panel must stay interactive — that is the panels' purpose. Closing is
 * explicit (close button, Escape, or the dock toggle), and focus returns to
 * the owning dock toggle by hand (a modal's focus scope would do this for us).
 */
export function MobilePanel({
  panelId,
  open,
  onClose,
  title,
  closeLabel,
  children,
}: MobilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Move SR/keyboard context into the panel once, when it opens — without
  // trapping. A stable ref + effect avoids re-focusing on every render (which
  // an inline ref callback would do, stealing focus from interactive children).
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  const close = () => {
    onClose();
    document.getElementById(`dock-toggle-${panelId}`)?.focus();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          id={`mobile-${panelId}-panel`}
          data-testid={`mobile-${panelId}-panel`}
          aria-labelledby={`mobile-${panelId}-panel-title`}
          data-placement="sheet"
          className={clsx(
            styles.panel,
            panelId === "song" ? styles.panelTall : styles.panelHalf,
          )}
          tabIndex={-1}
          ref={panelRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <header className={styles.panelHeader}>
            <h2 id={`mobile-${panelId}-panel-title`} className={styles.panelTitle}>
              {title}
            </h2>
            <button
              type="button"
              className={sharedStyles["icon-button"]}
              data-testid={`${panelId}-panel-close`}
              aria-label={closeLabel}
              onClick={close}
            >
              <X className="icon" aria-hidden="true" />
            </button>
          </header>
          <div className={styles.panelBody}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
