import { useAtom } from "jotai";
import { accidentalModeAtom, enharmonicDisplayAtom } from "../../../store/atoms";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { ACCIDENTAL_OPTIONS, ENHARMONIC_DISPLAY_OPTIONS, SETTING_FIELDS } from "../constants";
import { useTranslation } from "../../../hooks/useTranslation";
import clsx from "clsx";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

export default function NotationSettingsSection({ compact }: { compact?: boolean }) {
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const { t } = useTranslation();

  const fields = [
    {
      config: SETTING_FIELDS.accidentals,
      control: (
        <ToggleBar
          options={ACCIDENTAL_OPTIONS}
          value={accidentalMode}
          onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
          compact={compact}
        />
      ),
    },
    {
      config: SETTING_FIELDS.enharmonicDisplay,
      control: (
        <ToggleBar
          options={ENHARMONIC_DISPLAY_OPTIONS}
          value={enharmonicDisplay}
          onChange={(v) => setEnharmonicDisplay(v as typeof enharmonicDisplay)}
          compact={compact}
        />
      ),
    },
  ];

  return (
    <OverlaySection id="notation" title={t("settings.sections.notation")}>
      {fields.map(({ config, control }, index) => {
        return (
          <div
            key={config.key}
            className={clsx(
              styles["overlay-field"],
              config.className,
              index < fields.length - 1 && styles["overlay-field--divided"],
            )}
          >
            <OverlayFieldHeader label={t(config.labelKey)} />
            <div className={styles["overlay-field-control"]}>{control}</div>
            {config.hintKey ? (
              <p className={clsx(shared["field-hint"], styles["overlay-field-hint"])}>
                {t(config.hintKey)}
              </p>
            ) : null}
          </div>
        );
      })}
    </OverlaySection>
  );
}
