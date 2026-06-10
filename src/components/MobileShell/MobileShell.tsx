import { type ReactNode, useRef } from "react";
import { useAtomValue } from "jotai";
import { useTranslation } from "../../hooks/useTranslation";
import { mobileSheetSnapAtom } from "../../store/uiAtoms";
import { useUnhideMobileShell } from "./useUnhideMobileShell";
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
  const shellRef = useRef<HTMLDivElement>(null);
  // Stage spacing tracks the sheet's snap so the fretboard centers in the
  // space that is actually visible above the sheet (45dvh covered at half,
  // peek height at peek) — see the data-sheet-snap rules in the CSS module.
  const sheetSnap = useAtomValue(mobileSheetSnapAtom);
  // The always-open persistent MobileSheet is non-modal, but vaul 1.1.2 fails to
  // forward `modal={false}` to Radix, so Radix's `hideOthers` permanently marks
  // this shell `aria-hidden`. Keep the shell reachable by assistive tech.
  useUnhideMobileShell(shellRef);
  return (
    <div
      ref={shellRef}
      className={styles.shell}
      data-layout-tier={layoutTier}
      data-layout-variant={layoutVariant}
      data-sheet-snap={sheetSnap}
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
      {sheet}
    </div>
  );
}
