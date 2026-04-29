import { useAtom } from "jotai";
import clsx from "clsx";
import { chordFretSpreadAtom } from "../../../store/atoms";
import { StepperControl } from "../../StepperControl/StepperControl";
import { OverlaySection, OverlayFieldHeader } from "../shared";
import { SETTING_FIELDS } from "../constants";
import styles from "../SettingsOverlay.module.css";
import shared from "../../shared/shared.module.css";

export default function ChordLayoutSettingsSection({ compact }: { compact?: boolean }) {
  const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);
  const config = SETTING_FIELDS.chordSpread;

  return (
    <OverlaySection id="chord-layout" title="Chord Layout">
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={config.label} />
        <div className={styles["overlay-field-control"]}>
          <StepperControl
            value={chordFretSpread}
            onChange={setChordFretSpread}
            min={0}
            max={4}
            step={1}
            buttonVariant="mobile"
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
