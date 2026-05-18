import { useState, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import { useTranslation } from "../../hooks/useTranslation";
import { INSPECTOR_TABS, type InspectorTabId } from "./tabs";
import { ViewTab } from "./ViewTab";
import { ScaleTab } from "./ScaleTab";
import { ChordTab } from "./ChordTab";
import { ProgressionTab } from "./ProgressionTab";
import styles from "./Inspector.module.css";

const TAB_BODIES: Record<InspectorTabId, () => ReactNode> = {
  view: () => <ViewTab />,
  scale: () => <ScaleTab />,
  chord: () => <ChordTab />,
  progression: () => <ProgressionTab />,
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
  const [active, setActive] = useState<InspectorTabId>("view");

  return (
    <RadixTabs.Root
      className={clsx(styles.root, placement === "bottom" && styles.placementBottom)}
      data-placement={placement}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      {placement === "top" && (
        <span className={styles.panelLabel}>{t("inspector.panelLabel")}</span>
      )}
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
