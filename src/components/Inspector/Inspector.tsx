import { useState } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { useAtomValue } from "jotai";
import { progressionEnabledAtom } from "../../store/atoms";
import { useTranslation } from "../../hooks/useTranslation";
import {
  ALWAYS_VISIBLE_TABS,
  PROGRESSION_TAB,
  type InspectorTabId,
} from "./tabs";
import styles from "./Inspector.module.css";

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
          <RadixTabs.Trigger
            key={tab.id}
            value={tab.id}
            className={styles.tab}
          >
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
        />
      ))}
    </RadixTabs.Root>
  );
}
