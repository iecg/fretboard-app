import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { GroupHeader, PropGrid } from "./InspectorGrid";
import { Switch } from "../Switch/Switch";
import { useTranslation } from "../../hooks/useTranslation";
import { scaleVisibleAtom, toggleScaleVisibleAtom } from "../../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../../store/chordOverlayAtoms";
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
  const scaleVisible = useAtomValue(scaleVisibleAtom);
  const toggleScaleVisible = useSetAtom(toggleScaleVisibleAtom);
  const [chordOverlayHidden, setChordOverlayHidden] = useAtom(chordOverlayHiddenAtom);
  return (
    <div
      className={styles.root}
      data-inspector-tab="view"
      data-testid="view-tab"
    >
      <section className={styles.group} aria-labelledby="view-fingering-heading">
        <GroupHeader
          right={
            <Switch
              label={t("inspector.showOnBoard")}
              checked={scaleVisible}
              onChange={toggleScaleVisible}
            />
          }
        >
          <span id="view-fingering-heading">{t("inspector.groupScaleFingering")}</span>
        </GroupHeader>
        <PropGrid columns={6}>
          <FingeringPatternControls hideHeader />
        </PropGrid>
      </section>
      <section className={styles.group} aria-labelledby="view-voicing-heading">
        <GroupHeader
          right={
            <Switch
              label={t("inspector.showOnBoard")}
              checked={!chordOverlayHidden}
              onChange={(next) => setChordOverlayHidden(!next)}
            />
          }
        >
          <span id="view-voicing-heading">{t("inspector.groupChordVoicing")}</span>
        </GroupHeader>
        <ChordOverlayControls />
      </section>
    </div>
  );
}
