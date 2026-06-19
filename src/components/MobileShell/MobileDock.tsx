import { useAtom } from "jotai";
import { mobilePanelAtom, type MobilePanelId } from "@fretflow/fretboard/store/uiAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { INSPECTOR_TABS, type InspectorTabId } from "../Inspector/tabs";
import styles from "./MobileDock.module.css";

/** Maps the shared Inspector tab ids onto the dock's panel ids. */
const TAB_TO_PANEL: Record<InspectorTabId, Exclude<MobilePanelId, "none">> = {
  view: "overlay",
  song: "song",
};

/**
 * Fixed tab bar at the bottom of the mobile shell: the panel toggles
 * (Overlay / Song) sourced from the shared INSPECTOR_TABS config so
 * icons/labels never drift from the desktop tabs. Playback lives in the
 * ShellTransport strip under the header.
 *
 * Pressing an open panel's toggle closes it; pressing the other one switches.
 */
export function MobileDock() {
  const { t } = useTranslation();
  const [panel, setPanel] = useAtom(mobilePanelAtom);

  return (
    <div
      className={styles.dock}
      role="group"
      aria-label={t("mobileDock.label")}
      data-testid="mobile-dock"
      data-placement="sheet"
    >
      <div className={styles.toggleRow}>
        {INSPECTOR_TABS.map((tab) => {
          const target = TAB_TO_PANEL[tab.id];
          const open = panel === target;
          return (
            <button
              key={tab.id}
              type="button"
              id={`dock-toggle-${target}`}
              data-testid={`dock-toggle-${target}`}
              className={styles.toggle}
              data-state={open ? "open" : "closed"}
              aria-expanded={open}
              // Both panels are in-tree sibling regions with stable ids.
              aria-controls={`mobile-${target}-panel`}
              onClick={() => setPanel(open ? "none" : target)}
            >
              {tab.icon}
              <span>{t(`inspector.${tab.labelKey}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
