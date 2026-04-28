import { useAtom } from "jotai";
import clsx from "clsx";
import { accidentalModeAtom, enharmonicDisplayAtom } from "../../../store/atoms";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { ACCIDENTAL_OPTIONS, ENHARMONIC_DISPLAY_OPTIONS, SETTING_FIELDS } from "../constants";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

export default function NotationSettingsSection() {
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);

  const fields = [
    {
      config: SETTING_FIELDS.accidentals,
      control: (
        <ToggleBar
          options={ACCIDENTAL_OPTIONS}
          value={accidentalMode}
          onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
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
        />
      ),
    },
  ];

  return (
    <OverlaySection id="notation" title="Notation">
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
            <OverlayFieldHeader label={config.label} />
            <div className={styles["overlay-field-control"]}>{control}</div>
            {config.hint ? (
              <p className={clsx(shared["field-hint"], styles["overlay-field-hint"])}>
                {config.hint}
              </p>
            ) : null}
          </div>
        );
      })}
    </OverlaySection>
  );
}
