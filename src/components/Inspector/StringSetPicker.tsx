import clsx from "clsx";
import type { StringSetOption } from "../../store/voicingStringSets";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./StringSetPicker.module.css";

/**
 * Per-string bar thickness in pixels, indexed by string index
 * (0 = high E … 5 = low E). The fretboard's `--string-taper-*` proportional
 * curve, scaled up so the difference is legible in a small diagram.
 */
const STRING_BAR_THICKNESS_PX: readonly number[] = [1.5, 2.1, 2.7, 3.6, 4.5, 5.4];

interface StringSetPickerProps {
  /** The chord-appropriate option list (from `buildStringSetOptions`). */
  options: readonly StringSetOption[];
  /** The selected option id. */
  value: string;
  onChange: (value: string) => void;
}

/** Set lookup for the active string indices on a card. */
function isStringActive(strings: readonly number[]): (i: number) => boolean {
  const set = new Set(strings);
  return (i) => set.has(i);
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
        const selected = value === option.id;
        const label = t(option.labelKey);
        const sub = subText(option, t);
        const active = isStringActive(option.strings);
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} — ${sub}`}
            disabled={option.disabled}
            className={clsx(
              styles.card,
              selected && styles.cardActive,
              option.disabled && styles.cardDisabled,
            )}
            onClick={() => {
              if (option.disabled) return;
              onChange(option.id);
            }}
          >
            <span className={styles.diagram} aria-hidden="true">
              {/* Render bars in string-index order 0 (high E, thinnest) → 5
                  (low E, thickest). CSS lays them out top-to-bottom. */}
              {STRING_BAR_THICKNESS_PX.map((thicknessPx, stringIndex) => {
                const on = active(stringIndex);
                return (
                  <span
                    key={stringIndex}
                    data-string-index={stringIndex}
                    className={clsx(styles.string, on && styles.stringOn)}
                    style={{ height: `${thicknessPx}px` }}
                  />
                );
              })}
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
