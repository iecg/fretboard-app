import clsx from "clsx";
import { useAtom } from "jotai";
import { StepperControl } from "../../StepperControl/StepperControl";
import { FretRangeControl } from "../../FretRangeControl/FretRangeControl";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { Switch } from "../../Switch/Switch";
import { MAX_FRET, FRET_ZOOM_MIN, FRET_ZOOM_MAX } from "@fretflow/core";
import { ZOOM_STEP, SETTING_FIELDS } from "../constants";
import { OverlayFieldHeader } from "../shared";
import { useSettingsForm } from "../useSettingsForm";
import { useTranslation } from "../../../hooks/useTranslation";
import { accidentalModeAtom } from "../../../store/scaleAtoms";
import { enharmonicDisplayAtom } from "../../../store/audioAtoms";
import { scaleDegreeColorsEnabledAtom, displayFormatAtom } from "../../../store/uiAtoms";
import styles from "../SettingsOverlay.module.css";

export default function DisplaySettingsSection() {
  const { t } = useTranslation();
  const { fretZoom, setFretZoom, fretStart, setFretStart, fretEnd, setFretEnd } =
    useSettingsForm();

  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const [scaleDegreeColors, setScaleDegreeColors] = useAtom(scaleDegreeColorsEnabledAtom);

  const NOTE_LABEL_OPTIONS = [
    { value: "notes", label: t("inspector.notes") },
    { value: "degrees", label: t("inspector.intervals") },
    { value: "none", label: t("inspector.none") },
  ] as const;

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

  return (
    <>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t("controls.noteLabels")} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            label={t("controls.noteLabels")}
            options={NOTE_LABEL_OPTIONS}
            value={displayFormat}
            onChange={(v) => setDisplayFormat(v as "notes" | "degrees" | "none")}
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t("settings.fields.accidentals")} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            label={t("settings.fields.accidentals")}
            options={ACCIDENTAL_OPTIONS}
            value={accidentalMode}
            onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t("settings.fields.enharmonicDisplay")} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            label={t("settings.fields.enharmonicDisplay")}
            options={ENHARMONIC_OPTIONS}
            value={enharmonicDisplay}
            onChange={(v) => setEnharmonicDisplay(v as typeof enharmonicDisplay)}
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t(SETTING_FIELDS.zoom.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <StepperControl
            value={fretZoom}
            onChange={setFretZoom}
            min={FRET_ZOOM_MIN}
            max={FRET_ZOOM_MAX}
            step={ZOOM_STEP}
            formatValue={(zoom) => (zoom <= 100 ? t("settings.view.auto") : `${zoom}${t("settings.view.zoomSuffix")}`)}
            buttonVariant="mobile"
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t(SETTING_FIELDS.fretRange.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="mobile"
          />
        </div>
      </div>
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={t("inspector.degreeColors")} />
        <div className={styles["overlay-field-control"]}>
          <Switch
            label={t("inspector.degreeColors")}
            checked={scaleDegreeColors}
            onChange={setScaleDegreeColors}
          />
        </div>
      </div>
    </>
  );
}
