import type { CSSProperties, ReactNode } from "react";
import clsx from "clsx";
import styles from "./NotePill.module.css";

export interface NotePillProps {
  /** Note glyph shown in bold (e.g. "C", "F#"). */
  note: string;
  /** Interval label shown inline, dimmer (e.g. "1", "b3"). */
  interval?: string | null;
  /** Accessible label for the toggle button. */
  ariaLabel: string;
  /** Reflected as `aria-pressed` on the button. */
  pressed?: boolean;
  /** Toggle handler. When omitted the pill renders as a disabled button. */
  onToggle?: () => void;
  /** Force the interactive/disabled state; defaults to enabled when `onToggle` is set. */
  interactive?: boolean;
  /** Role-styling class applied to the pill `<button>`. */
  pillClassName?: string;
  /** Item-level styling class applied to the `<li>` wrapper. */
  itemClassName?: string;
  /** Class applied to the note glyph span. */
  noteClassName?: string;
  /** Class applied to the interval label span. */
  intervalClassName?: string;
  /** Inline style for the `<li>` (e.g. `--degree-color`). */
  itemStyle?: CSSProperties;
  /** Inline style for the pill `<button>` (e.g. `--degree-color`). */
  pillStyle?: CSSProperties;
  /** `data-*` attributes spread onto the `<li>`. */
  itemData?: Record<string, string | undefined>;
  /** `data-*` attributes spread onto the pill `<button>`. */
  pillData?: Record<string, string | undefined>;
  /** Extra content rendered after the interval (e.g. a resolve arrow). */
  children?: ReactNode;
}

/**
 * The shared note pill — a rounded, toggleable chip showing a note glyph and
 * an optional interval. Used for both the scale-degree chips and the chord
 * practice tone pills; role-specific coloring is supplied by the caller via
 * `pillClassName` / `itemClassName` and the `data-*` passthrough props.
 */
export function NotePill({
  note,
  interval,
  ariaLabel,
  pressed,
  onToggle,
  interactive,
  pillClassName,
  itemClassName,
  noteClassName,
  intervalClassName,
  itemStyle,
  pillStyle,
  itemData,
  pillData,
  children,
}: NotePillProps) {
  const enabled = interactive ?? Boolean(onToggle);
  return (
    <li className={clsx(styles.item, itemClassName)} style={itemStyle} {...itemData}>
      <button
        type="button"
        className={clsx(styles.pill, pillClassName)}
        aria-label={ariaLabel}
        aria-pressed={pressed}
        onClick={onToggle}
        disabled={!enabled}
        style={pillStyle}
        {...pillData}
      >
        <span className={clsx(styles.note, noteClassName)}>{note}</span>
        {interval ? (
          <span className={clsx(styles.interval, intervalClassName)}>{interval}</span>
        ) : null}
        {children}
      </button>
    </li>
  );
}
