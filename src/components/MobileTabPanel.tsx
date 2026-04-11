import { ToggleBar } from "./ToggleBar";
import "./MobileTabPanel.css";

interface MobileTabPanelProps {
  mobileTab: "key" | "scale" | "fretboard";
  setMobileTab: (tab: "key" | "scale" | "fretboard") => void;
  keyTabContent: React.ReactNode;
  scaleChordTabContent: React.ReactNode;
  settingsTabContent: React.ReactNode;
}

const MOBILE_TAB_OPTIONS = [
  { value: "key", label: "Key" },
  { value: "scale", label: "Scale" },
  { value: "fretboard", label: "Fretboard" },
];

export function MobileTabPanel({
  mobileTab,
  setMobileTab,
  keyTabContent,
  scaleChordTabContent,
  settingsTabContent,
}: MobileTabPanelProps) {
  return (
    <>
      <ToggleBar
        options={MOBILE_TAB_OPTIONS}
        value={mobileTab}
        onChange={(v) => setMobileTab(v as "key" | "scale" | "fretboard")}
        variant="tabs"
      />
      <div className="mobile-tab-content">
        {mobileTab === "key" && keyTabContent}
        {mobileTab === "scale" && scaleChordTabContent}
        {mobileTab === "fretboard" && settingsTabContent}
      </div>
    </>
  );
}
