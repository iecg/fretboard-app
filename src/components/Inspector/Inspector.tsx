import { useState, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { useAtomValue } from "jotai";
import { progressionEnabledAtom } from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import {
  ALWAYS_VISIBLE_TABS,
  PROGRESSION_TAB,
  type InspectorTabId,
} from "./tabs";
import { ViewTab } from "./ViewTab";
import { ScaleTab } from "./ScaleTab";
import { ChordTab } from "./ChordTab";
import styles from "./Inspector.module.css";

const TAB_BODIES: Record<InspectorTabId, () => ReactNode> = {
  view: () => <ViewTab />,
  scale: () => <ScaleTab />,
  chord: () => <ChordTab />,
  progression: () => null, // Phase 5 will mount ProgressionControls here.
};

export function Inspector() {
  const { t } = useTranslation();
  const [active, setActive] = useState<InspectorTabId>("view");
  const progressionEnabled = useAtomValue(progressionEnabledAtom);

  const visibleTabs = progressionEnabled
    ? [...ALWAYS_VISIBLE_TABS, PROGRESSION_TAB]
    : ALWAYS_VISIBLE_TABS;

  return (
    <RadixTabs.Root
      className={styles.root}
      value={active}
      onValueChange={(value) => setActive(value as InspectorTabId)}
    >
      <RadixTabs.List className={styles.tabList} aria-label="Inspector">
        {visibleTabs.map((tab) => (
          <RadixTabs.Trigger key={tab.id} value={tab.id} className={styles.tab}>
            {t(`inspector.${tab.labelKey}`)}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {visibleTabs.map((tab) => (
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
