import { useAtom } from "jotai";
import clsx from "clsx";
import { chordFretSpreadAtom } from "../../../store/atoms";
import { StepperControl } from "../../StepperControl/StepperControl";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { SETTING_FIELDS } from "../constants";
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

export default function ChordLayoutSettingsSection() {
  const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);
  const { t } = useTranslation();
  const config = SETTING_FIELDS.chordSpread;

  return (
    <OverlaySection id="chord-layout" title={t("settings.sections.chordLayout")}>
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={t(config.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <StepperControl
            value={chordFretSpread}
            onChange={setChordFretSpread}
            min={0}
            max={4}
            step={1}
            buttonVariant="mobile"
          />
        </div>
        {config.hintKey ? (
          <p className={clsx(shared["field-hint"], styles["overlay-field-hint"])}>
            {t(config.hintKey)}
          </p>
        ) : null}
      </div>
    </OverlaySection>
  );
}
