import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { GroupHeader, PropGrid } from "./InspectorGrid";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ViewTab.module.css";

/**
 * The View tab in the 2-tab Inspector. Two groups, side by side on desktop and
 * stacked on smaller variants:
 *
 *   1. SCALE FINGERING — renders FingeringPatternControls (pattern, shape,
 *      position).
 *   2. CHORD VOICING — renders ChordOverlayControls (voicing, lens, etc).
 *
 * This component intentionally owns no atoms of its own — it's a structural
 * shell that two existing controls plug into. Plan B replaces what
 * ChordOverlayControls renders; Plan A only restructures the host.
 */
export function ViewTab() {
  const { t } = useTranslation();
  return (
    <div
      className={styles.root}
      data-inspector-tab="view"
      data-testid="view-tab"
    >
      <section className={styles.group} aria-labelledby="view-fingering-heading">
        <GroupHeader>
          <span id="view-fingering-heading">{t("inspector.groupScaleFingering")}</span>
        </GroupHeader>
        <PropGrid columns={6}>
          <FingeringPatternControls />
        </PropGrid>
      </section>
      <section className={styles.group} aria-labelledby="view-voicing-heading">
        <GroupHeader>
          <span id="view-voicing-heading">{t("inspector.groupChordVoicing")}</span>
        </GroupHeader>
        <ChordOverlayControls />
      </section>
    </div>
  );
}
