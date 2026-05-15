import { useAtom } from "jotai";
import {
  fretStartAtom,
  fretEndAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  scaleDegreeColorsEnabledAtom,
} from "../../store/atoms";
import { MAX_FRET } from "@fretflow/core";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { useTranslation } from "../../hooks/useTranslation";
import shared from "../shared/shared.module.css";
import styles from "./ViewTab.module.css";

const ACCIDENTAL_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "♯", value: "sharps" },
  { label: "♭", value: "flats" },
] as const;

const ENHARMONIC_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
] as const;

export function ViewTab() {
  const { t } = useTranslation();
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const [scaleDegreeColors, setScaleDegreeColors] = useAtom(scaleDegreeColorsEnabledAtom);

  return (
    <div className={styles.root} data-inspector-tab="view">
      <FingeringPatternControls />
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Fret Range</span>
        <FretRangeControl
          startFret={fretStart}
          endFret={fretEnd}
          onStartChange={setFretStart}
          onEndChange={setFretEnd}
          maxFret={MAX_FRET}
          layout="dashboard"
        />
      </div>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>
          {t("settings.fields.accidentals")}
        </span>
        <ToggleBar
          label={t("settings.fields.accidentals")}
          options={ACCIDENTAL_OPTIONS}
          value={accidentalMode}
          onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
        />
        <p className={shared["field-hint"]}>{t("settings.fields.accidentalsHint")}</p>
      </div>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>
          {t("settings.fields.enharmonicDisplay")}
        </span>
        <ToggleBar
          label={t("settings.fields.enharmonicDisplay")}
          options={ENHARMONIC_OPTIONS}
          value={enharmonicDisplay}
          onChange={(v) => setEnharmonicDisplay(v as typeof enharmonicDisplay)}
        />
        <p className={shared["field-hint"]}>
          {t("settings.fields.enharmonicDisplayHint")}
        </p>
      </div>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>
          {t("settings.fields.scaleDegreeColors")}
        </span>
        <ToggleBar
          label={t("settings.fields.scaleDegreeColors")}
          options={[
            { value: "false", label: t("controls.off") },
            { value: "true", label: t("controls.on") },
          ]}
          value={String(scaleDegreeColors)}
          onChange={(v) => setScaleDegreeColors(v === "true")}
        />
        <p className={shared["field-hint"]}>
          {t("settings.fields.scaleDegreeColorsHint")}
        </p>
      </div>
    </div>
  );
}
