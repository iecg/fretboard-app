import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { PropGrid } from "./InspectorGrid";
import { InspectorCard } from "./InspectorCard";
import { useTranslation } from "../../hooks/useTranslation";
import { scaleVisibleAtom, toggleScaleVisibleAtom } from "@fretflow/fretboard/store/scaleAtoms";
import { chordOverlayHiddenAtom } from "@fretflow/fretboard/store/chordOverlayAtoms";
import styles from "./ViewTab.module.css";

/**
 * The Overlay tab (formerly View) in the 2-tab Inspector. Two sectioned cards
 * stack vertically:
 *
 *   1. SCALE — hosts FingeringPatternControls (pattern, shape, position).
 *   2. CHORD — hosts ChordOverlayControls (voicing, lens, string set, lock-to-scale).
 *
 * This component owns no atoms beyond the two master visibility flags. The
 * card chrome lives in the shared `InspectorCard` primitive — also used by
 * the Song tab.
 */
export function ViewTab() {
  const { t } = useTranslation();
  const scaleVisible = useAtomValue(scaleVisibleAtom);
  const toggleScaleVisible = useSetAtom(toggleScaleVisibleAtom);
  const [chordOverlayHidden, setChordOverlayHidden] = useAtom(chordOverlayHiddenAtom);
  const chordVisible = !chordOverlayHidden;
  return (
    <div
      className={styles.root}
      data-inspector-tab="view"
      data-testid="view-tab"
    >
      <InspectorCard
        active={scaleVisible}
        onToggle={toggleScaleVisible}
        toggleLabel={t("inspector.showOnBoard")}
        name={t("inspector.groupScaleFingering")}
        description={t("inspector.groupScaleFingeringDesc")}
        stateLabel={scaleVisible ? t("inspector.stateShowing") : t("inspector.stateHidden")}
        labelledById="view-fingering-heading"
      >
        <PropGrid columns={12}>
          <FingeringPatternControls hideHeader />
        </PropGrid>
      </InspectorCard>
      <InspectorCard
        active={chordVisible}
        onToggle={(next) => setChordOverlayHidden(!next)}
        toggleLabel={t("inspector.showOnBoard")}
        name={t("inspector.groupChordVoicing")}
        description={t("inspector.groupChordVoicingDesc")}
        stateLabel={chordVisible ? t("inspector.stateShowing") : t("inspector.stateHidden")}
        labelledById="view-voicing-heading"
      >
        <ChordOverlayControls />
      </InspectorCard>
    </div>
  );
}
