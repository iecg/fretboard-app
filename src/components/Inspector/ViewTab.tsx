import { useAtom } from "jotai";
import { enharmonicDisplayAtom } from "../../store/audioAtoms";
import { fretStartAtom, fretEndAtom } from "../../store/layoutAtoms";
import { accidentalModeAtom } from "../../store/scaleAtoms";
import { scaleDegreeColorsEnabledAtom, displayFormatAtom } from "../../store/uiAtoms";
import { MAX_FRET } from "@fretflow/core";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { PropGrid, Prop, GroupHeader } from "./InspectorGrid";
import useLayoutMode from "../../hooks/useLayoutMode";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ViewTab.module.css";

export function ViewTab() {
  const { t } = useTranslation();
  const { tier, variant } = useLayoutMode();

  const ACCIDENTAL_OPTIONS = [
    { label: t("inspector.auto"), value: "auto" },
    { label: "♯", value: "sharps" },
    { label: "♭", value: "flats" },
  ] as const;

  const ENHARMONIC_OPTIONS = [
    { label: t("inspector.auto"), value: "auto" },
    { label: t("controls.on"), value: "on" },
    { label: t("controls.off"), value: "off" },
  ] as const;

  const NOTE_LABEL_OPTIONS = [
    { value: "notes", label: t("inspector.notes") },
    { value: "degrees", label: t("inspector.intervals") },
    { value: "none", label: t("inspector.none") },
  ] as const;
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const [scaleDegreeColors, setScaleDegreeColors] = useAtom(scaleDegreeColorsEnabledAtom);
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);

  return (
    <div className={styles.root} data-inspector-tab="view" data-layout-tier={tier} data-layout-variant={variant}>
      <PropGrid columns={tier === "mobile" ? 2 : 6}>
        <GroupHeader>{t("inspector.groupLabels")}</GroupHeader>
        <Prop label={t("controls.noteLabels")} span={2}>
          <ToggleBar
            label={t("controls.noteLabels")}
            options={NOTE_LABEL_OPTIONS}
            value={displayFormat}
            onChange={(v) => setDisplayFormat(v as "notes" | "degrees" | "none")}
          />
        </Prop>
        <Prop label={t("settings.fields.accidentals")} span={2}>
          <ToggleBar
            label={t("settings.fields.accidentals")}
            options={ACCIDENTAL_OPTIONS}
            value={accidentalMode}
            onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
          />
        </Prop>
        <Prop label={t("settings.fields.enharmonicDisplay")} span={2}>
          <ToggleBar
            label={t("settings.fields.enharmonicDisplay")}
            options={ENHARMONIC_OPTIONS}
            value={enharmonicDisplay}
            onChange={(v) => setEnharmonicDisplay(v as typeof enharmonicDisplay)}
          />
        </Prop>

        <GroupHeader>{t("inspector.groupDisplay")}</GroupHeader>
        <Prop label={t("settings.fields.fretRange")} span={2}>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="inline"
          />
        </Prop>
        <Prop
          label={t("inspector.degreeColors")}
          span={1}
          hint={scaleDegreeColors ? t("inspector.statusByDegree") : t("inspector.statusUniform")}
        >
          <Switch
            label={t("inspector.degreeColors")}
            checked={scaleDegreeColors}
            onChange={setScaleDegreeColors}
          />
        </Prop>
      </PropGrid>
    </div>
  );
}
