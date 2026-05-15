import clsx from "clsx";
import { StepperControl } from "../../StepperControl/StepperControl";
import { FretRangeControl } from "../../FretRangeControl/FretRangeControl";
import { MAX_FRET, FRET_ZOOM_MIN, FRET_ZOOM_MAX } from "@fretflow/core";
import { ZOOM_STEP, SETTING_FIELDS } from "../constants";
import { OverlayFieldHeader } from "../shared";
import { useSettingsForm } from "../useSettingsForm";
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "../SettingsOverlay.module.css";

export default function ViewSettingsSection() {
  const { t } = useTranslation();
  const { fretZoom, setFretZoom, fretStart, setFretStart, fretEnd, setFretEnd } =
    useSettingsForm();
  return (
    <>
      <div
        className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}
      >
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
      <div className={styles["overlay-field"]}>
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
    </>
  );
}
