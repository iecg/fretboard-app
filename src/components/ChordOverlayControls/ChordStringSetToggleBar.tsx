import { useEffect, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  voicingStringSetAtom,
  stringSetOptionsAtom,
} from "@fretflow/fretboard/store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { ToggleBar } from "../ToggleBar/ToggleBar";

/**
 * String-set picker for close-voicing mode. Renders one button per
 * consecutive-string window (no "All" button — per the spec, "All" is not a
 * pickable concept in close mode).
 *
 * Visual: uses ToggleBar's `chip` variant so it shares chrome with the CAGED
 * shape toggle. Disabled options stay visible with their `disabledReason` as
 * the title tooltip — communicates dead-end positions honestly.
 *
 * Auto-heal: if the stored window becomes invalid/disabled and another option
 * is enabled, snaps to the first enabled option. No-op if all options are
 * disabled (the toggle bar then visibly shows the dead-end).
 */
export function ChordStringSetToggleBar() {
  const { t } = useTranslation();
  const [value, setValue] = useAtom(voicingStringSetAtom);
  const options = useAtomValue(stringSetOptionsAtom);

  useEffect(() => {
    const match = options.find((o) => o.id === value);
    if (!match || match.disabled) {
      const firstEnabled = options.find((o) => !o.disabled);
      if (firstEnabled) {
        setValue(firstEnabled.id);
      }
    }
  }, [value, options, setValue]);

  const toggleOptions = useMemo(
    () =>
      options.map((opt) => ({
        value: opt.id,
        label: opt.strings.map((n) => String(n + 1)).join("·"),
        disabled: opt.disabled,
        title: opt.disabled ? opt.disabledReason : undefined,
      })),
    [options],
  );

  if (options.length === 0) return null;

  return (
    <ToggleBar
      variant="chip"
      options={toggleOptions}
      value={value}
      onChange={setValue}
      label={t("inspector.chordStringSetLabel")}
    />
  );
}
