import { type ReactNode } from "react";
import styles from "./MainLayoutWrapper.module.css";

interface MainLayoutWrapperProps {
  children: ReactNode;
  header: ReactNode;
  summary?: ReactNode;
  controlsPanel?: ReactNode;
  statusBar?: ReactNode;
  helpModal?: ReactNode;
  settingsOverlay?: ReactNode;
  layoutTier: string;
  layoutVariant: string;
  isChordActive: boolean;
  showSummary: boolean;
  showControlsPanel: boolean;
  showStatusBar: boolean;
}

export function MainLayoutWrapper({
  children,
  header,
  summary,
  controlsPanel,
  statusBar,
  helpModal,
  settingsOverlay,
  layoutTier,
  layoutVariant,
  isChordActive,
  showSummary,
  showControlsPanel,
  showStatusBar,
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

      {showSummary && !!summary && (
        <div
          className={styles["summary-shell"]}
          data-testid="summary-shell"
          data-layout-tier={layoutTier}
          data-layout-variant={layoutVariant}
        >
          {summary}
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

      {showStatusBar && !!statusBar && (
        <div className={styles["status-bar-shell"]} data-testid="status-bar-shell">
          {statusBar}
        </div>
      )}

      {settingsOverlay}
    </div>
  );
}
