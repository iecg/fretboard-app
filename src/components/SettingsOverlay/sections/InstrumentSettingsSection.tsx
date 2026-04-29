import { LabeledSelect } from "../../LabeledSelect/LabeledSelect";
import { TUNINGS } from "../../../core/guitar";
import { SETTING_FIELDS } from "../constants";
import { OverlayFieldHeader } from "../shared";
import { useSettingsForm } from "../useSettingsForm";
import styles from "../SettingsOverlay.module.css";

export default function InstrumentSettingsSection({ compact }: { compact?: boolean }) {
  const { tuningName, setTuningName } = useSettingsForm();

  return (
    <div className={styles["overlay-field"]}>
      <OverlayFieldHeader label={SETTING_FIELDS.tuning.label} />
      <div className={styles["overlay-field-control"]}>
        <LabeledSelect
          label={SETTING_FIELDS.tuning.label}
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
