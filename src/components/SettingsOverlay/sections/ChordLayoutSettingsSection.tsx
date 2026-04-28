import { useAtom } from "jotai";
import clsx from "clsx";
import { chordFretSpreadAtom } from "../../../store/atoms";
import { StepperControl } from "../../StepperControl/StepperControl";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { SETTING_FIELDS } from "../constants";
import { type HelpFieldId } from "../types";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

interface ChordLayoutSettingsSectionProps {
  activeHelpField: HelpFieldId | null;
  handleHelpToggle: (id: HelpFieldId) => void;
  registerHelpContainer: (id: HelpFieldId, node: HTMLDivElement | null) => void;
}

export function ChordLayoutSettingsSection({
  activeHelpField,
  handleHelpToggle,
  registerHelpContainer,
}: ChordLayoutSettingsSectionProps) {
  const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);
  const config = SETTING_FIELDS.chordSpread;
  const isHelpOpen = config.help?.id === activeHelpField;
  const helpId = config.help?.id;
  const helpContainerRef = helpId
    ? (node: HTMLDivElement | null) => registerHelpContainer(helpId, node)
    : undefined;

  return (
    <OverlaySection id="chord-layout" title="Chord Layout">
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
          <StepperControl
            value={chordFretSpread}
            onChange={setChordFretSpread}
            min={0}
            max={4}
            step={1}
            buttonVariant="mobile"
          />
        </div>
        {config.help ? (
          <p className={shared["shape-hint"]}>{config.help.content}</p>
        ) : null}
      </div>
    </OverlaySection>
  );
}
