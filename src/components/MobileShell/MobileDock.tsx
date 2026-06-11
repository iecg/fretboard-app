import { useAtom } from "jotai";
import { mobilePanelAtom, type MobilePanelId } from "../../store/uiAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { INSPECTOR_TABS, type InspectorTabId } from "../Inspector/tabs";
import { DockTransport } from "./DockTransport";
import styles from "./MobileDock.module.css";

/** Maps the shared Inspector tab ids onto the dock's panel ids. */
const TAB_TO_PANEL: Record<InspectorTabId, Exclude<MobilePanelId, "none">> = {
  view: "overlay",
  song: "song",
};

/**
 * Fixed two-row transport dock at the bottom of the mobile shell.
 *
 * Top row: panel toggles (Overlay / Song) sourced from the shared
 * INSPECTOR_TABS config so icons/labels never drift from the desktop tabs.
 * Bottom row: the always-visible mini-player transport — kept on the bottom
 * edge so play/stop stays in the thumb zone.
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
              // The Overlay panel is an in-tree sibling region; the Song panel
              // is a portaled full-screen dialog (no stable id to point at).
              aria-controls={target === "overlay" ? "mobile-overlay-panel" : undefined}
              aria-haspopup={target === "song" ? "dialog" : undefined}
              onClick={() => setPanel(open ? "none" : target)}
            >
              {tab.icon}
              <span>{t(`inspector.${tab.labelKey}`)}</span>
            </button>
          );
        })}
      </div>
      <DockTransport />
    </div>
  );
}
