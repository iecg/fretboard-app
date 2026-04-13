import { CircleOfFifths } from "../CircleOfFifths";
import { ToggleBar } from "./ToggleBar";
import "./TabletPortraitPanel.css";

interface TabletPortraitPanelProps {
  tabletTab: "settings" | "scales";
  setTabletTab: (tab: "settings" | "scales") => void;
  settingsTabContent: React.ReactNode;
  scaleChordTabContent: React.ReactNode;
  rootNote: string;
  setRootNote: (note: string) => void;
  scaleName: string;
  useFlats: boolean;
  enharmonicDisplay?: "auto" | "on" | "off";
}

const TABLET_TAB_OPTIONS = [
  { value: "settings", label: "Controls" },
  { value: "scales", label: "Scales" },
] as const;

export function TabletPortraitPanel({
  tabletTab,
  setTabletTab,
  settingsTabContent,
  scaleChordTabContent,
  rootNote,
  setRootNote,
  scaleName,
  useFlats,
  enharmonicDisplay = "auto",
}: TabletPortraitPanelProps) {
  return (
    <div className="tablet-portrait-panel">
      {/* Left column: Settings/Scales tabs */}
      <div className="tablet-portrait-settings-col panel-surface">
        <ToggleBar
          options={TABLET_TAB_OPTIONS}
          value={tabletTab}
          onChange={setTabletTab}
          variant="default"
        />
        <div className="tablet-tab-content">
          {tabletTab === "settings" ? settingsTabContent : scaleChordTabContent}
        </div>
      </div>
      {/* Right column: CoF fixed-width */}
      <div className="tablet-portrait-cof-col panel-surface">
        <h2>Key</h2>
        <CircleOfFifths
          rootNote={rootNote}
          setRootNote={setRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
          enharmonicDisplay={enharmonicDisplay}
        />
      </div>
    </div>
  );
}
