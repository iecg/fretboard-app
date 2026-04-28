import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './DegreeChipStrip.module.css';

export interface DegreeChip {
  note: string;
  internalNote: string;
  interval: string;
  inScale: boolean;
  isTonic?: boolean;
  scaleDegree?: string;
  degreeColor?: string;
}

export interface DegreeChipStripProps {
  scaleName: string;
  chips: DegreeChip[];
  hiddenNotes?: Set<string>;
  onChipToggle?: (internalNote: string) => void;
  /** Scale-owned color notes (blue notes, modal characteristic tones). */
  colorNotes?: Set<string>;
  className?: string;
  'aria-label'?: string;
  hideHeader?: boolean;
  /** When false, hides the chip list. Default true. */
  visible?: boolean;
  /** Rendered inside the header landmark, to the right of the scale name. */
  headerAction?: ReactNode;
  /** Compact mode — smaller chips and tighter padding for secondary surfaces. */
  compact?: boolean;
}

export function DegreeChipStrip({
  scaleName,
  chips,
  hiddenNotes,
  onChipToggle,
  colorNotes,
  className,
  'aria-label': ariaLabel,
  hideHeader,
  visible = true,
  headerAction,
  compact,
}: DegreeChipStripProps) {
  const label = ariaLabel ?? `Scale degrees for ${scaleName}`;

  return (
    <section
      role="group"
      aria-label={label}
      className={clsx(styles['degree-chip-strip'], compact && styles['degree-chip-strip--compact'], className)}
      data-scale-visible={visible ? 'true' : 'false'}
    >
      {(!hideHeader || headerAction) && (
        <header
          className={styles['degree-chip-strip-header']}
          data-has-action={headerAction ? 'true' : undefined}
        >
          {headerAction}
          {!hideHeader && scaleName}
        </header>
      )}
      {visible && (
        <ul className={styles['degree-chip-strip-list']}>
          {chips.map((chip, i) => {
            const isHidden = hiddenNotes?.has(chip.internalNote) ?? false;
            const isColorNote = colorNotes?.has(chip.internalNote) ?? false;
            return (
              <li
                key={`${chip.note}-${i}`}
                className={styles['degree-chip-item']}
                data-in-scale={chip.inScale ? 'true' : undefined}
                data-is-tonic={chip.isTonic ? 'true' : undefined}
                data-hidden={isHidden ? 'true' : undefined}
                data-is-color-note={isColorNote ? 'true' : undefined}
                data-scale-degree={chip.scaleDegree}
                style={chip.degreeColor ? { "--degree-color": chip.degreeColor } as React.CSSProperties : undefined}
              >
                <button
                  type="button"
                  className={styles['degree-chip']}
                  aria-pressed={isHidden}
                  aria-label={`${isHidden ? 'Show' : 'Hide'} ${chip.note}`}
                  onClick={() => onChipToggle?.(chip.internalNote)}
                  disabled={!onChipToggle}
                >
                  <span className={styles['degree-chip-note']}>{chip.note}</span>
                </button>
                <span className={styles['degree-chip-interval']}>{chip.interval}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
