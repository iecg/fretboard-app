import { type ReactNode } from "react";
import styles from "./MainLayoutWrapper.module.css";

interface MainLayoutWrapperProps {
  children: ReactNode;
  header: ReactNode;
  summary?: ReactNode;
  chordDock?: ReactNode;
  controlsPanel?: ReactNode;
  mobileTabs?: ReactNode;
  helpModal?: ReactNode;
  settingsOverlay?: ReactNode;
  versionBadge?: ReactNode;
  layoutTier: string;
  layoutVariant: string;
  isChordActive: boolean;
  showSummary: boolean;
  showChordDock: boolean;
  showControlsPanel: boolean;
  showMobileTabs: boolean;
}

export function MainLayoutWrapper({
  children,
  header,
  summary,
  chordDock,
  controlsPanel,
  mobileTabs,
  helpModal,
  settingsOverlay,
  versionBadge,
  layoutTier,
  layoutVariant,
  isChordActive,
  showSummary,
  showChordDock,
  showControlsPanel,
  showMobileTabs,
}: MainLayoutWrapperProps) {
  return (
    <div
      className="app-container"
      data-layout-tier={layoutTier}
      data-layout-variant={layoutVariant}
      data-chord-active={isChordActive ? "true" : undefined}
      data-testid="app-container"
    >
      {header}

      {showSummary && (
        <div
          className={styles["summary-shell"]}
          data-testid="summary-shell"
          data-layout-tier={layoutTier}
          data-layout-variant={layoutVariant}
        >
          {summary}
        </div>
      )}

      {showChordDock && (
        <div
          className={styles["chord-dock-shell"]}
          data-layout-tier={layoutTier}
          data-layout-variant={layoutVariant}
        >
          {chordDock}
        </div>
      )}

      {helpModal}

      <main
        className={styles["main-fretboard"]}
        data-layout-tier={layoutTier}
        data-layout-variant={layoutVariant}
        data-testid="main-fretboard"
      >
        {children}
      </main>

      {showControlsPanel && controlsPanel}

      {showMobileTabs && mobileTabs}

      {versionBadge}

      {settingsOverlay}
    </div>
  );
}
