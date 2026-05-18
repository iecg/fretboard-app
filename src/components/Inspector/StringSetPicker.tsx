import clsx from "clsx";
import type { VoicingStringSet } from "@fretflow/core";
import styles from "./StringSetPicker.module.css";

interface StringSetPickerProps {
  value: VoicingStringSet;
  onChange: (value: VoicingStringSet) => void;
}

interface StringSetCard {
  id: VoicingStringSet;
  label: string;
  sub: string;
  /** mask top→bottom = string 6 (low E) → string 1 (high E). */
  mask: boolean[];
}

const CARDS: StringSetCard[] = [
  { id: "all", label: "All", sub: "6 strings", mask: [true, true, true, true, true, true] },
  { id: "low", label: "Bass", sub: "4·5·6", mask: [true, true, true, false, false, false] },
  { id: "mid", label: "Lower mid", sub: "3·4·5", mask: [false, true, true, true, false, false] },
  { id: "mid-hi", label: "Upper mid", sub: "2·3·4", mask: [false, false, true, true, true, false] },
  { id: "top", label: "Treble", sub: "1·2·3", mask: [false, false, false, true, true, true] },
];

export function StringSetPicker({ value, onChange }: StringSetPickerProps) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="String set">
      {CARDS.map((card) => {
        const active = value === card.id;
        return (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${card.label} — ${card.sub}`}
            className={clsx(styles.card, active && styles.cardActive)}
            onClick={() => onChange(card.id)}
          >
            <span className={styles.diagram} aria-hidden="true">
              {[...card.mask].reverse().map((on, i) => (
                <span
                  key={i}
                  className={clsx(styles.string, on && styles.stringOn)}
                  style={{ height: `${1 + i * 0.4}px` }}
                />
              ))}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{card.label}</span>
              <span className={styles.sub}>{card.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
