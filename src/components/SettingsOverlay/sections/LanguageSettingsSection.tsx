import { useAtom } from "jotai";
import { languageAtom } from "../../../store/languageAtom";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { LANGUAGE_OPTIONS } from "../constants";
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "../SettingsOverlay.module.css";
import type { SupportedLanguage } from "../../../i18n/types";

export default function LanguageSettingsSection({ compact }: { compact?: boolean }) {
  const [language, setLanguage] = useAtom(languageAtom);
  const { t } = useTranslation();

  return (
    <OverlaySection id="language" title={t("settings.language")}>
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={t("settings.language")} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(v) => setLanguage(v as SupportedLanguage)}
            compact={compact}
          />
        </div>
      </div>
    </OverlaySection>
  );
}
