import { useAtom } from "jotai";
import { Switch } from "../Switch/Switch";
import { chordSnapToScaleAtom } from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";

/**
 * Toggles whether close-voicing candidates are filtered to the active
 * scale-fingering window. Rendered by ChordOverlayControls only when a
 * fingering pattern is selected (otherwise there is no window to snap to).
 */
export function ChordSnapToScaleToggle() {
  const { t } = useTranslation();
  const [checked, setChecked] = useAtom(chordSnapToScaleAtom);
  return (
    <Switch
      label={t("inspector.chordSnapToScaleLabel")}
      checked={checked}
      onChange={setChecked}
    />
  );
}
