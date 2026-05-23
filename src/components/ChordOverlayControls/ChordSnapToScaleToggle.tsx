import { useAtom } from "jotai";
import { Switch } from "../Switch/Switch";
import { chordSnapToScaleAtom } from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";

export interface ChordSnapToScaleToggleProps {
  /** Disabled state — applies to single-string and two-string patterns. */
  disabled?: boolean;
}

/**
 * Toggles whether close-voicing candidates are filtered to the active
 * scale-fingering window. Rendered by ChordOverlayControls only when a
 * fingering pattern is selected (otherwise there is no window to snap to).
 *
 * Disabled when fingeringPattern is "one-string" or "two-strings" (no scale
 * window to lock to). Enabled for "caged" and "3nps".
 */
export function ChordSnapToScaleToggle({ disabled = false }: ChordSnapToScaleToggleProps = {}) {
  const { t } = useTranslation();
  const [checked, setChecked] = useAtom(chordSnapToScaleAtom);
  return (
    <Switch
      label={t("inspector.chordLockToScaleLabel")}
      checked={checked}
      onChange={setChecked}
      disabled={disabled}
    />
  );
}
