import clsx from "clsx";
import styles from "./ChordTypeGrid.module.css";

export interface ChordTypeOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ChordTypeGridProps {
  options: readonly ChordTypeOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the button group. */
  label: string;
}

/**
 * Chord-quality picker for the Chord tab's CHORD TYPE group — the chord types
 * as a wrapping grid of cells. A standalone component (not a `ToggleBar`
 * variant) so the shared `ToggleBar` is untouched. Renders `role="group"` with
 * `aria-pressed` buttons, matching the accessibility shape callers query.
 */
export function ChordTypeGrid({ options, value, onChange, label }: ChordTypeGridProps) {
  return (
    <div className={styles.grid} role="group" aria-label={label}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={clsx(styles.cell, isActive && styles.cellActive)}
            aria-pressed={isActive}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
