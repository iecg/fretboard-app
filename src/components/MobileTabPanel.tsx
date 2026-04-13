import { ToggleBar } from "./ToggleBar";
import "./MobileTabPanel.css";

interface MobileTabPanelProps {
  mobileTab: "key" | "scale" | "settings";
  setMobileTab: (tab: "key" | "scale" | "settings") => void;
  keyTabContent: React.ReactNode;
  scaleChordTabContent: React.ReactNode;
  settingsTabContent: React.ReactNode;
}

const MOBILE_TAB_OPTIONS = [
  { value: "key", label: "Key" },
  { value: "scale", label: "Scale" },
  { value: "settings", label: "Settings" },
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
        onChange={(v) => setMobileTab(v as "key" | "scale" | "settings")}
        variant="tabs"
      />
      <div className="mobile-tab-content">
        {mobileTab === "key" && keyTabContent}
        {mobileTab === "scale" && scaleChordTabContent}
        {mobileTab === "settings" && settingsTabContent}
      </div>
    </>
  );
}
