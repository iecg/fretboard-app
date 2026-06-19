import { useAtom, useAtomValue } from "jotai";
import {
  chordTypeAtom,
  voicingAtom,
} from "@fretflow/fretboard/store/chordOverlayAtoms";
import { practiceLensAtom, type PracticeLens } from "@fretflow/fretboard/store/practiceLensAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { VoicingControl } from "./VoicingControl";
import { ChordStringSetToggleBar } from "./ChordStringSetToggleBar";
import panelStyles from "./ChordOverlayControls.module.css";

export function ChordOverlayControls() {
  const { t } = useTranslation();

  const chordType = useAtomValue(chordTypeAtom);
  const voicing = useAtomValue(voicingAtom);
  const [lens, setLens] = useAtom(practiceLensAtom);

  const hasActiveChord = Boolean(chordType);

  const lensOptions: ReadonlyArray<{ value: PracticeLens; label: string }> = [
    { value: "root", label: t("inspector.lensRoot") },
    { value: "guide", label: t("inspector.lensGuide") },
    { value: "common", label: t("inspector.lensCommon") },
  ];

  return (
    <div className={panelStyles.root}>
      <PropGrid columns={12} className={panelStyles.grid}>
        <Prop label={t("inspector.voicingLabel")} span={3}>
          <VoicingControl />
        </Prop>
        <Prop label={t("inspector.lensLabel")} span={9}>
          <ToggleBar
            variant="chip"
            options={lensOptions}
            value={lens}
            onChange={setLens}
            label={t("inspector.lensLabel")}
          />
        </Prop>
        {voicing === "close" && hasActiveChord ? (
          <Prop label={t("inspector.chordStringSetLabel")} span={12}>
            <ChordStringSetToggleBar />
          </Prop>
        ) : null}
      </PropGrid>
    </div>
  );
}
