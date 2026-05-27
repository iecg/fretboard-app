import { useAtomValue } from "jotai";
import {
  chordTypeAtom,
  voicingAtom,
} from "../../store/chordOverlayAtoms";
import { hasFallbackPositionsAtom } from "../../store/voicingFallbackAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { VoicingControl } from "./VoicingControl";
import { ChordStringSetPicker } from "./ChordStringSetPicker";
import panelStyles from "./ChordOverlayControls.module.css";

export function ChordOverlayControls() {
  const { t } = useTranslation();

  const chordType = useAtomValue(chordTypeAtom);
  const voicing = useAtomValue(voicingAtom);
  const hasFallback = useAtomValue(hasFallbackPositionsAtom);

  const hasActiveChord = Boolean(chordType);

  return (
    <div className={panelStyles.root}>
      <PropGrid columns={12} className={panelStyles.grid}>
        <Prop label={t("inspector.voicingLabel")} span={3}>
          <VoicingControl />
        </Prop>
        {(voicing === "close" || (voicing === "full" && hasFallback)) && hasActiveChord ? (
          <Prop label={t("inspector.chordStringSetLabel")} span={2}>
            <ChordStringSetPicker />
          </Prop>
        ) : null}
      </PropGrid>
    </div>
  );
}
