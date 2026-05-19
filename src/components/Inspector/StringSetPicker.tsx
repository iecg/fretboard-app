import clsx from "clsx";
import type { StringSetOption } from "../../store/voicingStringSets";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./StringSetPicker.module.css";

interface StringSetPickerProps {
  /** The chord-appropriate option list (from `buildStringSetOptions`). */
  options: readonly StringSetOption[];
  /** The selected option id. */
  value: string;
  onChange: (value: string) => void;
}

/** Six-string on/off mask for a diagram, index 0 = high E … 5 = low E. */
function diagramMask(strings: readonly number[]): boolean[] {
  const set = new Set(strings);
  return [0, 1, 2, 3, 4, 5].map((i) => set.has(i));
}

/**
 * The locale-neutral sub-text: the option id for a window ("4·5·6"), or a
 * localized "6 strings" for the All option.
 */
function subText(option: StringSetOption, t: (key: string) => string): string {
  return option.id === "all" ? t("inspector.stringSetAllSub") : option.id;
}

export function StringSetPicker({ options, value, onChange }: StringSetPickerProps) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.grid}
      role="radiogroup"
      aria-label={t("inspector.voicingStringSet")}
    >
      {options.map((option) => {
        const active = value === option.id;
        const label = t(option.labelKey);
        const sub = subText(option, t);
        const mask = diagramMask(option.strings);
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} — ${sub}`}
            className={clsx(styles.card, active && styles.cardActive)}
            onClick={() => onChange(option.id)}
          >
            <span className={styles.diagram} aria-hidden="true">
              {/* Reverse so low-E (thick) renders at the bottom, high-E (thin) at the top. */}
              {[...mask].reverse().map((on, i) => (
                <span
                  key={i}
                  className={clsx(styles.string, on && styles.stringOn)}
                  style={{ height: `${1 + i * 0.4}px` }}
                />
              ))}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{label}</span>
              <span className={styles.sub}>{sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
