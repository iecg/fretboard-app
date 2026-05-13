import { useAtom } from "jotai";
import clsx from "clsx";
import { themeAtom } from "../../../store/atoms";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { THEME_OPTIONS, SETTING_FIELDS } from "../constants";
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

export default function AppearanceSettingsSection({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useAtom(themeAtom);
  const { t } = useTranslation();

  const config = SETTING_FIELDS.theme;

  return (
    <OverlaySection id="appearance" title={t("settings.sections.appearance")}>
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={config.label} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            options={THEME_OPTIONS}
            value={theme}
            onChange={(v) => setTheme(v as typeof theme)}
            compact={compact}
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
