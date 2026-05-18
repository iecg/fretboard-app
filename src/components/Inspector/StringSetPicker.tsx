import clsx from "clsx";
import type { VoicingStringSet } from "@fretflow/core";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./StringSetPicker.module.css";

interface StringSetPickerProps {
  value: VoicingStringSet;
  onChange: (value: VoicingStringSet) => void;
}

interface StringSetCard {
  id: VoicingStringSet;
  labelKey: string;
  subKey: string;
  /** mask index 0→5 = string 6 (low E) → string 1 (high E). Rendered reversed (low E at bottom). */
  mask: boolean[];
}

const CARDS: StringSetCard[] = [
  {
    id: "all",
    labelKey: "inspector.stringSetAll",
    subKey: "inspector.stringSetAllSub",
    mask: [true, true, true, true, true, true],
  },
  {
    id: "low",
    labelKey: "inspector.stringSetBass",
    subKey: "inspector.stringSetBassSub",
    mask: [true, true, true, false, false, false],
  },
  {
    id: "mid",
    labelKey: "inspector.stringSetLowerMid",
    subKey: "inspector.stringSetLowerMidSub",
    mask: [false, true, true, true, false, false],
  },
  {
    id: "mid-hi",
    labelKey: "inspector.stringSetUpperMid",
    subKey: "inspector.stringSetUpperMidSub",
    mask: [false, false, true, true, true, false],
  },
  {
    id: "top",
    labelKey: "inspector.stringSetTreble",
    subKey: "inspector.stringSetTrebleSub",
    mask: [false, false, false, true, true, true],
  },
];

export function StringSetPicker({ value, onChange }: StringSetPickerProps) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.grid}
      role="radiogroup"
      aria-label={t("inspector.voicingStringSet")}
    >
      {CARDS.map((card) => {
        const active = value === card.id;
        const label = t(card.labelKey);
        const sub = t(card.subKey);
        return (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} — ${sub}`}
            className={clsx(styles.card, active && styles.cardActive)}
            onClick={() => onChange(card.id)}
          >
            <span className={styles.diagram} aria-hidden="true">
              {/* Reverse so low-E (thick) renders at the bottom, high-E (thin) at the top. */}
              {[...card.mask].reverse().map((on, i) => (
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
