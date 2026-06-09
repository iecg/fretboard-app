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
