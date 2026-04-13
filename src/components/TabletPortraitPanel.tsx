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
  setUseFlats: (flats: boolean) => void;
}

const TABLET_TAB_OPTIONS = [
  { value: "settings", label: "Settings" },
  { value: "scales", label: "Scales" },
];

export function TabletPortraitPanel({
  tabletTab,
  setTabletTab,
  settingsTabContent,
  scaleChordTabContent,
  rootNote,
  setRootNote,
  scaleName,
  useFlats,
  setUseFlats,
}: TabletPortraitPanelProps) {
  return (
    <div className="tablet-portrait-panel">
      {/* Left column: Settings/Scales tabs */}
      <div className="tablet-portrait-settings-col">
        <ToggleBar
          options={TABLET_TAB_OPTIONS}
          value={tabletTab}
          onChange={(v) => setTabletTab(v as "settings" | "scales")}
          variant="default"
        />
        {tabletTab === "settings" && (
          <div className="tablet-tab-content">{settingsTabContent}</div>
        )}
        {tabletTab === "scales" && (
          <div className="tablet-tab-content">{scaleChordTabContent}</div>
        )}
      </div>
      {/* Right column: CoF fixed-width */}
      <div className="tablet-portrait-cof-col">
        <h2>Key</h2>
        <button
          className="accidental-toggle"
          onClick={() => setUseFlats(!useFlats)}
          title={
            useFlats
              ? "Showing flats — click for sharps"
              : "Showing sharps — click for flats"
          }
        >
          {useFlats ? "♭" : "♯"}
        </button>
        <CircleOfFifths
          rootNote={rootNote}
          setRootNote={setRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
        />
      </div>
    </div>
  );
}
