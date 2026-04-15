import type React from "react";
import { ToggleBar } from "./ToggleBar";

const MOBILE_TAB_OPTIONS = [
  { value: "key", label: "Key" },
  { value: "scale", label: "Scales" },
  { value: "fretboard", label: "Controls" },
] as const;

type MobileTabValue = (typeof MOBILE_TAB_OPTIONS)[number]["value"];

interface MobileTabPanelProps {
  mobileTab: MobileTabValue;
  setMobileTab: (tab: MobileTabValue) => void;
  keyTabContent: React.ReactNode;
  scaleChordTabContent: React.ReactNode;
  settingsTabContent: React.ReactNode;
}

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
        onChange={setMobileTab}
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
