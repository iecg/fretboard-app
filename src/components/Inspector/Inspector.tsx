import { useState, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import { useTranslation } from "../../hooks/useTranslation";
import { INSPECTOR_TABS, type InspectorTabId } from "./tabs";
import { ScaleTab } from "./ScaleTab";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { ProgressionControls } from "../ProgressionControls/ProgressionControls";
import styles from "./Inspector.module.css";

const TAB_BODIES: Record<InspectorTabId, () => ReactNode> = {
  scale: () => <ScaleTab />,
  chord: () => (
    <div className={styles.tabBody} data-inspector-tab="chord">
      <ChordOverlayControls />
    </div>
  ),
  song: () => (
    <div className={styles.tabBody} data-inspector-tab="song">
      <ProgressionControls />
    </div>
  ),
};

export interface InspectorProps {
  /**
   * "top" (default) renders inline text-only tabs at the top of the panel.
   * "bottom" docks the tab list to the bottom of the viewport as an
   * icon+label bar — used on the mobile tier and the tablet-split variant.
   */
  placement?: "top" | "bottom";
}

export function Inspector({ placement = "top" }: InspectorProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<InspectorTabId>("scale");

  const tabList = (
    <RadixTabs.List className={styles.tabList} aria-label="Inspector">
      {INSPECTOR_TABS.map((tab) => (
        <RadixTabs.Trigger key={tab.id} value={tab.id} className={styles.tab}>
          <span className={styles.tabIcon} aria-hidden="true">
            {tab.icon}
          </span>
          <span className={styles.tabLabel}>{t(`inspector.${tab.labelKey}`)}</span>
        </RadixTabs.Trigger>
      ))}
    </RadixTabs.List>
  );

  return (
    <RadixTabs.Root
      className={clsx(styles.root, placement === "bottom" && styles.placementBottom)}
      data-placement={placement}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      {placement === "top" ? (
        <div className={styles.tabHeader}>
          <span className={styles.panelLabel}>{t("inspector.panelLabel")}</span>
          {tabList}
        </div>
      ) : (
        tabList
      )}
      {INSPECTOR_TABS.map((tab) => (
        <RadixTabs.Content
          key={tab.id}
          value={tab.id}
          className={styles.tabPanel}
          data-tab-id={tab.id}
        >
          {TAB_BODIES[tab.id]()}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
