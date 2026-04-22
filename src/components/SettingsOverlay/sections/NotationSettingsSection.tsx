import { useAtom } from "jotai";
import clsx from "clsx";
import { accidentalModeAtom, enharmonicDisplayAtom } from "../../../store/atoms";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { ACCIDENTAL_OPTIONS, ENHARMONIC_DISPLAY_OPTIONS, SETTING_FIELDS } from "../constants";
import { type HelpFieldId } from "../types";
import styles from "../SettingsOverlay.module.css";

interface NotationSettingsSectionProps {
  activeHelpField: HelpFieldId | null;
  handleHelpToggle: (id: HelpFieldId) => void;
  registerHelpContainer: (id: HelpFieldId, node: HTMLDivElement | null) => void;
}

export function NotationSettingsSection({
  activeHelpField,
  handleHelpToggle,
  registerHelpContainer,
}: NotationSettingsSectionProps) {
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
        const isHelpOpen = config.help?.id === activeHelpField;
        const helpId = config.help?.id;
        const helpContainerRef = helpId
          ? (node: HTMLDivElement | null) => registerHelpContainer(helpId, node)
          : undefined;

        return (
          <div
            key={config.key}
            className={clsx(
              styles["overlay-field"],
              config.className,
              isHelpOpen && styles["overlay-field--help-open"],
              index < fields.length - 1 && styles["overlay-field--divided"],
            )}
          >
            <OverlayFieldHeader
              label={config.label}
              help={config.help}
              isHelpOpen={Boolean(isHelpOpen)}
              onToggleHelp={() => config.help && handleHelpToggle(config.help.id)}
              helpContainerRef={helpContainerRef}
            />
            <div className={styles["overlay-field-control"]}>{control}</div>
          </div>
        );
      })}
    </OverlaySection>
  );
}
