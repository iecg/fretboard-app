import { useAtom } from "jotai";
import type { HandSize } from "@fretflow/core";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { OverlayFieldHeader } from "../shared";
import { useTranslation } from "../../../hooks/useTranslation";
import { handSizeAtom } from "../../../store/settingsAtoms";
import styles from "../SettingsOverlay.module.css";

export default function HandSizeSection() {
  const { t } = useTranslation();
  const [handSize, setHandSize] = useAtom(handSizeAtom);

  const OPTIONS: ReadonlyArray<{ value: HandSize; label: string }> = [
    { value: "small", label: t("settings.fields.handSizeSmall") },
    { value: "medium", label: t("settings.fields.handSizeMedium") },
    { value: "large", label: t("settings.fields.handSizeLarge") },
  ];

  return (
    <div className={styles["overlay-field"]}>
      <OverlayFieldHeader label={t("settings.fields.handSize")} />
      <div className={styles["overlay-field-control"]}>
        <ToggleBar
          label={t("settings.fields.handSize")}
          options={OPTIONS}
          value={handSize}
          onChange={(v) => setHandSize(v as HandSize)}
        />
      </div>
    </div>
  );
}
