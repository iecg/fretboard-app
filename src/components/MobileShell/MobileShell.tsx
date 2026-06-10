import { type ReactNode } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./MobileShell.module.css";

interface MobileShellProps {
  /** Fretboard stage content. */
  children: ReactNode;
  header: ReactNode;
  /** Progression chip strip. */
  track: ReactNode;
  /** Bottom sheet (MobileSheet). */
  sheet: ReactNode;
  layoutTier: string;
  layoutVariant: string;
}

/**
 * Fixed, non-scrolling mobile app surface. Owns only structure: compact
 * header, progression strip, fretboard stage (fills remaining height), and
 * the bottom sheet. All behavior lives in the shared components passed in.
 */
export function MobileShell({
  children,
  header,
  track,
  sheet,
  layoutTier,
  layoutVariant,
}: MobileShellProps) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.shell}
      data-layout-tier={layoutTier}
      data-layout-variant={layoutVariant}
      data-testid="mobile-shell"
    >
      {/* Portrait lock — CSS-only, shown via @media orientation:landscape at
          viewport ≤ 767px (mobile tier), the only tier this shell renders in. */}
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
      {sheet}
    </div>
  );
}
