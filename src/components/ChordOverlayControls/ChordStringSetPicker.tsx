import { useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  voicingStringSetAtom,
  stringSetOptionsAtom,
} from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";

/** Format an option id for display.
 *
 * - "all" → the localized "All" label.
 * - "0-1-2-3" → "1·2·3·4" (guitar-numbered, dot separator).
 */
function labelForOption(id: string, allLabel: string): string {
  if (id === "all") return allLabel;
  return id
    .split("-")
    .map((n) => String(parseInt(n, 10) + 1))
    .join("·");
}

/**
 * Picks which consecutive-string window the Close voicing engine should
 * restrict candidates to. Rendered only when voicing === "close" by the
 * parent ChordOverlayControls.
 */
export function ChordStringSetPicker() {
  const { t } = useTranslation();
  const [value, setValue] = useAtom(voicingStringSetAtom);
  const options = useAtomValue(stringSetOptionsAtom);

  const allLabel = t("inspector.chordStringSetAll");
  const items = useMemo(
    () =>
      options.map((o) => ({
        value: o.id,
        label: labelForOption(o.id, allLabel),
      })),
    [options, allLabel],
  );

  return (
    <LabeledSelect
      label={t("inspector.chordStringSetLabel")}
      hideLabel
      value={value}
      onChange={setValue}
      options={items}
      // TODO(F7): pass `fit` once LabeledSelect ships the prop in Task 7.
    />
  );
}
