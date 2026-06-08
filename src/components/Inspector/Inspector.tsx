import { useState, type ReactNode } from "react";
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
  // Keep-alive: once a tab has been opened, keep its body mounted (Radix hides
  // it with the `hidden` attribute). Returning to a visited tab is then a cheap
  // visibility toggle instead of remounting a heavy subtree (e.g. SongControls),
  // whose synchronous mount blocks the main thread — that block stalls the rAF
  // visual clock (snapping the WAAPI playhead) and starves Tone's lookahead
  // scheduler (audio glitch). Unvisited tabs stay unmounted (no startup cost).
  const [visited, setVisited] = useState<Set<InspectorTabId>>(() => new Set([active]));

  const handleValueChange = (value: string) => {
    const id = value as InspectorTabId;
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setActive(id);
  };

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
      onValueChange={handleValueChange}
    >
      {placement === "top" ? <div className={styles.tabHeader}>{tabList}</div> : tabList}
      {INSPECTOR_TABS.map((tab) => (
        <RadixTabs.Content
          key={tab.id}
          value={tab.id}
          className={styles.tabPanel}
          data-tab-id={tab.id}
          // Visited tabs stay mounted (Radix sets `hidden` when inactive) so
          // re-selecting them never remounts the subtree. Unvisited tabs render
          // lazily on first open.
          forceMount={visited.has(tab.id) ? true : undefined}
        >
          {TAB_BODIES[tab.id]()}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
