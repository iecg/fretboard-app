import { useAtomValue } from "jotai";
import {
  chordTypeAtom,
  voicingAtom,
} from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { VoicingControl } from "./VoicingControl";
import { ChordStringSetToggleBar } from "./ChordStringSetToggleBar";
import panelStyles from "./ChordOverlayControls.module.css";

export function ChordOverlayControls() {
  const { t } = useTranslation();

  const chordType = useAtomValue(chordTypeAtom);
  const voicing = useAtomValue(voicingAtom);

  const hasActiveChord = Boolean(chordType);

  return (
    <div className={panelStyles.root}>
      <PropGrid columns={12} className={panelStyles.grid}>
        <Prop label={t("inspector.voicingLabel")} span={3}>
          <VoicingControl />
        </Prop>
        {voicing === "close" && hasActiveChord ? (
          <Prop label={t("inspector.chordStringSetLabel")} span={9}>
            <ChordStringSetToggleBar />
          </Prop>
        ) : null}
      </PropGrid>
    </div>
  );
}
