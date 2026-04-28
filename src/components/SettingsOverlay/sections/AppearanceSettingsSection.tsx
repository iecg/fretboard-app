import { useAtom } from "jotai";
import clsx from "clsx";
import { themeAtom } from "../../../store/atoms";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { THEME_OPTIONS, SETTING_FIELDS } from "../constants";
import { type HelpFieldId } from "../types";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

interface AppearanceSettingsSectionProps {
  activeHelpField: HelpFieldId | null;
  handleHelpToggle: (id: HelpFieldId) => void;
  registerHelpContainer: (id: HelpFieldId, node: HTMLDivElement | null) => void;
}

export function AppearanceSettingsSection({
  activeHelpField,
  handleHelpToggle,
  registerHelpContainer,
}: AppearanceSettingsSectionProps) {
  const [theme, setTheme] = useAtom(themeAtom);

  const config = SETTING_FIELDS.theme;
  const isHelpOpen = config.help?.id === activeHelpField;
  const helpId = config.help?.id;
  const helpContainerRef = helpId
    ? (node: HTMLDivElement | null) => registerHelpContainer(helpId, node)
    : undefined;

  return (
    <OverlaySection id="appearance" title="Appearance">
      <div
        className={clsx(
          styles["overlay-field"],
          isHelpOpen && styles["overlay-field--help-open"],
        )}
      >
        <OverlayFieldHeader
          label={config.label}
          help={config.help}
          isHelpOpen={Boolean(isHelpOpen)}
          onToggleHelp={() => config.help && handleHelpToggle(config.help.id)}
          helpContainerRef={helpContainerRef}
        />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            options={THEME_OPTIONS}
            value={theme}
            onChange={(v) => setTheme(v as typeof theme)}
          />
        </div>
        {config.help ? (
          <p className={shared["field-hint"]}>{config.help.content}</p>
        ) : null}
      </div>
    </OverlaySection>
  );
}
