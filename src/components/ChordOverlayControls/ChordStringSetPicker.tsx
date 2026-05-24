import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  voicingStringSetAtom,
  stringSetOptionsAtom,
} from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { StringSetPicker } from "../shared/StringSetPicker";

/**
 * Picks which consecutive-string window the Close voicing engine should
 * restrict candidates to. Rendered only when voicing === "close" by the
 * parent ChordOverlayControls.
 */
export function ChordStringSetPicker() {
  const { t } = useTranslation();
  const [value, setValue] = useAtom(voicingStringSetAtom);
  const options = useAtomValue(stringSetOptionsAtom);

  // Auto-heal/transition: if current selected string set is invalid or disabled,
  // snap to the first available (enabled) contiguous string window.
  useEffect(() => {
    const match = options.find((o) => o.id === value);
    if (!match || match.disabled) {
      const firstEnabled = options.find((o) => !o.disabled);
      if (firstEnabled) {
        setValue(firstEnabled.id);
      }
    }
  }, [value, options, setValue]);

  return (
    <StringSetPicker
      label={t("inspector.chordStringSetLabel")}
      allLabel={t("inspector.chordStringSetAll")}
      value={value}
      onChange={setValue}
      options={options}
      width="fill"
    />
  );
}
