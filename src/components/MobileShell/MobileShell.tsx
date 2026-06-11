import { type ReactNode } from "react";
import { useAtomValue } from "jotai";
import { useTranslation } from "../../hooks/useTranslation";
import { mobilePanelAtom } from "../../store/uiAtoms";
import styles from "./MobileShell.module.css";

interface MobileShellProps {
  /** Fretboard stage content. */
  children: ReactNode;
  header: ReactNode;
  /** Progression chip strip. */
  track: ReactNode;
  /** Non-modal Overlay panel (MobileOverlayPanel) — anchored above the dock. */
  panel: ReactNode;
  /** Fixed bottom dock (MobileDock). */
  dock: ReactNode;
  layoutTier: string;
  layoutVariant: string;
}

/**
 * Fixed, non-scrolling mobile app surface. Owns only structure: compact
 * header, progression strip, fretboard stage (fills remaining height), the
 * Overlay panel slot, and the bottom dock. All behavior lives in the shared
 * components passed in.
 */
export function MobileShell({
  children,
  header,
  track,
  panel,
  dock,
  layoutTier,
  layoutVariant,
}: MobileShellProps) {
  const { t } = useTranslation();
  // Stage spacing tracks the open panel so the fretboard centers in the band
  // that is actually visible — see the data-mobile-panel rules in the CSS.
  const mobilePanel = useAtomValue(mobilePanelAtom);
  return (
    <div
      className={styles.shell}
      data-layout-tier={layoutTier}
      data-layout-variant={layoutVariant}
      data-mobile-panel={mobilePanel}
      data-testid="mobile-shell"
    >
      {/* Portrait lock — CSS-only, shown via @media (max-width:767px) AND
          landscape. MobileShell also renders at tablet-split (768–1023px), but
          the show rule never fires there — identical to the old global
          behaviour. */}
      <div className={styles.rotateOverlay} role="alert" aria-live="polite">
        <div className={styles.rotateOverlayContent}>
          <svg
            className={styles.rotateOverlayIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M12 18h.01" />
          </svg>
          <p className={styles.rotateOverlayMessage}>
            {t("common.rotateMessage")}
          </p>
        </div>
      </div>
      <div className={styles.header}>{header}</div>
      <div className={styles.track}>{track}</div>
      <main
        aria-label={t("mobileShell.stageLabel")}
        className={styles.stage}
        data-testid="mobile-stage"
      >
        {children}
      </main>
      {panel}
      {dock}
    </div>
  );
}
