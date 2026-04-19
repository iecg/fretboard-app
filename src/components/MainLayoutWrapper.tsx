import { type ReactNode } from "react";

interface MainLayoutWrapperProps {
  children: ReactNode;
  header: ReactNode;
  summary?: ReactNode;
  controlsPanel?: ReactNode;
  mobileTabs?: ReactNode;
  helpModal?: ReactNode;
  settingsOverlay?: ReactNode;
  versionBadge?: ReactNode;
  layoutTier: string;
  layoutVariant: string;
  isChordActive: boolean;
  showSummary: boolean;
  showControlsPanel: boolean;
  showMobileTabs: boolean;
}

export function MainLayoutWrapper({
  children,
  header,
  summary,
  controlsPanel,
  mobileTabs,
  helpModal,
  settingsOverlay,
  versionBadge,
  layoutTier,
  layoutVariant,
  isChordActive,
  showSummary,
  showControlsPanel,
  showMobileTabs,
}: MainLayoutWrapperProps) {
  return (
    <div
      className="app-container"
      data-layout-tier={layoutTier}
      data-layout-variant={layoutVariant}
      data-chord-active={isChordActive ? "true" : undefined}
    >
      {header}

      {showSummary && <div className="summary-shell">{summary}</div>}

      {helpModal}

      <main className="main-fretboard">{children}</main>

      {showControlsPanel && controlsPanel}

      {showMobileTabs && mobileTabs}

      {versionBadge}

      {settingsOverlay}
    </div>
  );
}
