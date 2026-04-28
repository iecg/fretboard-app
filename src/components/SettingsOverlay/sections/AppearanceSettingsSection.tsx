import { useAtom } from "jotai";
import clsx from "clsx";
import { themeAtom } from "../../../store/atoms";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { THEME_OPTIONS, SETTING_FIELDS } from "../constants";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

export default function AppearanceSettingsSection() {
  const [theme, setTheme] = useAtom(themeAtom);

  const config = SETTING_FIELDS.theme;

  return (
    <OverlaySection id="appearance" title="Appearance">
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={config.label} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            options={THEME_OPTIONS}
            value={theme}
            onChange={(v) => setTheme(v as typeof theme)}
          />
        </div>
        {config.hint ? (
          <p className={clsx(shared["field-hint"], styles["overlay-field-hint"])}>
            {config.hint}
          </p>
        ) : null}
      </div>
    </OverlaySection>
  );
}
