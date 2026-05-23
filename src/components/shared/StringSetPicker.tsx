import { useMemo } from "react";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";

export interface StringSetOptionInput {
  /** Stable id, used as the LabeledSelect value. */
  id: string;
  /** Optional explicit label. If omitted, derived from `strings`. */
  label?: string;
  /** Optional 0-based string indices (high E = 0). Used to format the label
   * when `label` is not provided — produces "1·2·3·4" (guitar-numbered). */
  strings?: readonly number[];
  /** When true, the option renders disabled. Pair with `disabledReason`. */
  disabled?: boolean;
  /** Tooltip shown when hovering a disabled option. */
  disabledReason?: string;
}

export interface StringSetPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly StringSetOptionInput[];
  /** Override the i18n "All" label when id === "all" and no label given. */
  allLabel?: string;
}

function formatLabel(opt: StringSetOptionInput, allLabel: string): string {
  if (opt.label) return opt.label;
  if (opt.id === "all") return allLabel;
  if (opt.strings && opt.strings.length > 0) {
    return opt.strings.map((n) => String(n + 1)).join("·");
  }
  return opt.id;
}

export function StringSetPicker({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: StringSetPickerProps) {
  const items = useMemo(
    () =>
      options.map((opt) => ({
        value: opt.id,
        label: formatLabel(opt, allLabel),
        disabled: opt.disabled,
      })),
    [options, allLabel],
  );
  return (
    <LabeledSelect
      label={label}
      hideLabel
      fit
      value={value}
      onChange={onChange}
      options={items as Array<{ value: string; label: string; disabled?: boolean }>}
    />
  );
}
