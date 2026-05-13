import clsx from "clsx";
import { useAtom } from "jotai";
import { StepperControl } from "../../StepperControl/StepperControl";
import { FretRangeControl } from "../../FretRangeControl/FretRangeControl";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { MAX_FRET, FRET_ZOOM_MIN, FRET_ZOOM_MAX } from "@fretflow/core";
import { ZOOM_STEP, SETTING_FIELDS } from "../constants";
import { OverlayFieldHeader } from "../shared";
import { useSettingsForm } from "../useSettingsForm";
import { compactDensityAtom } from "../../../store/atoms";
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

export default function ViewSettingsSection({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const {
    fretZoom,
    setFretZoom,
    fretStart,
    setFretStart,
    fretEnd,
    setFretEnd,
    scaleDegreeColorsEnabled,
    setScaleDegreeColorsEnabled,
  } = useSettingsForm();
  const [compactDensity, setCompactDensity] = useAtom(compactDensityAtom);

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
            formatValue={(zoom) => (zoom <= 100 ? "Auto" : `${zoom}%`)}
            buttonVariant="mobile"
            compact={compact}
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
            compact={compact}
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label="Compact Controls" />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            options={[
              { value: "auto", label: "Auto" },
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
            value={compactDensity}
            onChange={(v) => setCompactDensity(v as "auto" | "on" | "off")}
            label="Compact controls"
            compact={compact}
          />
        </div>
        <p className={clsx(shared["field-hint"], styles["overlay-field-hint"])}>
          Auto: compact on mobile and portrait tablet.
        </p>
      </div>
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={t(SETTING_FIELDS.scaleDegreeColors.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            options={[
              { value: "false", label: "Off" },
              { value: "true", label: "On" },
            ]}
            value={String(scaleDegreeColorsEnabled)}
            onChange={(v) => setScaleDegreeColorsEnabled(v === "true")}
            compact={compact}
          />
        </div>
        {SETTING_FIELDS.scaleDegreeColors.hintKey && (
          <p className={clsx(shared["field-hint"], styles["overlay-field-hint"])}>
            {t(SETTING_FIELDS.scaleDegreeColors.hintKey)}
          </p>
        )}
      </div>
    </>
  );
}
