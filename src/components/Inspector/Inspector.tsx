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
  const progressionEnabled = useAtomValue(progressionEnabledAtom);

  const visibleTabs = progressionEnabled
    ? [...ALWAYS_VISIBLE_TABS, PROGRESSION_TAB]
    : ALWAYS_VISIBLE_TABS;

  // Derive the effective tab: if the stored active tab is no longer visible
  // (e.g. the Progression tab was selected, then dismissed when progression
  // mode turned off), fall back to View so the panel never points at an
  // unmounted tab. Derived rather than stored to avoid a setState-in-effect.
  const effectiveActive = visibleTabs.some((tab) => tab.id === active)
    ? active
    : "view";

  return (
    <RadixTabs.Root
      className={styles.root}
      value={effectiveActive}
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
