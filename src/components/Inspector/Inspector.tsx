import { useState, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
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

export function Inspector() {
  const { t } = useTranslation();
  const [active, setActive] = useState<InspectorTabId>("view");

  return (
    <RadixTabs.Root
      className={styles.root}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      <RadixTabs.List className={styles.tabList} aria-label="Inspector">
        {INSPECTOR_TABS.map((tab) => (
          <RadixTabs.Trigger key={tab.id} value={tab.id} className={styles.tab}>
            {t(`inspector.${tab.labelKey}`)}
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
