import type React from "react";
import { ToggleBar } from "./ToggleBar";

const MOBILE_TAB_OPTIONS = [
  { value: "theory", label: "Theory" },
  { value: "view", label: "View" },
] as const;

type MobileTabValue = (typeof MOBILE_TAB_OPTIONS)[number]["value"];

interface MobileTabPanelProps {
  mobileTab: MobileTabValue;
  setMobileTab: (tab: MobileTabValue) => void;
  theoryTabContent: React.ReactNode;
  viewTabContent: React.ReactNode;
}

export function MobileTabPanel({
  mobileTab,
  setMobileTab,
  theoryTabContent,
  viewTabContent,
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
        {mobileTab === "theory" && theoryTabContent}
        {mobileTab === "view" && viewTabContent}
      </div>
    </>
  );
}
