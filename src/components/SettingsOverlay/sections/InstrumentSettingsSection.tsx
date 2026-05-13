import { LabeledSelect } from "../../LabeledSelect/LabeledSelect";
import { TUNINGS } from "@fretflow/core";
import { SETTING_FIELDS } from "../constants";
import { OverlayFieldHeader } from "../shared";
import { useSettingsForm } from "../useSettingsForm";
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "../SettingsOverlay.module.css";

export default function InstrumentSettingsSection({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { tuningName, setTuningName } = useSettingsForm();

  return (
    <div className={styles["overlay-field"]}>
      <OverlayFieldHeader label={t(SETTING_FIELDS.tuning.labelKey)} />
      <div className={styles["overlay-field-control"]}>
        <LabeledSelect
          label={t(SETTING_FIELDS.tuning.labelKey)}
          value={tuningName}
          options={Object.keys(TUNINGS).map((name) => ({ value: name, label: name }))}
          onChange={setTuningName}
          hideLabel
          compact={compact}
        />
      </div>
    </div>
  );
}
