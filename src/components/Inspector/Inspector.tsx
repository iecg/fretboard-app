import { type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { useAtom } from "jotai";
import clsx from "clsx";
import { useTranslation } from "../../hooks/useTranslation";
import { INSPECTOR_TABS, type InspectorTabId } from "./tabs";
import { inspectorActiveTabAtom } from "../../store/inspectorAtoms";
import { ViewTab } from "./ViewTab";
import { SongControls } from "../SongControls/SongControls";
import styles from "./Inspector.module.css";

const TAB_BODIES: Record<InspectorTabId, () => ReactNode> = {
  view: () => <ViewTab />,
  song: () => (
    <div className={styles.tabBody} data-inspector-tab="song">
      <SongControls />
    </div>
  ),
};

export interface InspectorProps {
  placement?: "top" | "bottom";
}

export function Inspector({ placement = "top" }: InspectorProps) {
  const { t } = useTranslation();
  const [active, setActive] = useAtom(inspectorActiveTabAtom);

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
      {placement === "top" ? <div className={styles.tabHeader}>{tabList}</div> : tabList}
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
