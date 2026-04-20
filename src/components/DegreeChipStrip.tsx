import type { ReactNode } from 'react';
import clsx from 'clsx';
import './DegreeChipStrip.css';

export interface DegreeChip {
  note: string;
  internalNote: string;
  interval: string;
  inScale: boolean;
  isTonic?: boolean;
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
}: DegreeChipStripProps) {
  const label = ariaLabel ?? `Scale degrees for ${scaleName}`;

  return (
    <section
      role="group"
      aria-label={label}
      className={clsx('degree-chip-strip', className)}
      data-scale-visible={visible ? 'true' : 'false'}
    >
      {(!hideHeader || headerAction) && (
        <header
          className="degree-chip-strip-header"
          data-has-action={headerAction ? 'true' : undefined}
        >
          {!hideHeader && scaleName}
          {headerAction}
        </header>
      )}
      {visible && (
        <ul className="degree-chip-strip-list">
          {chips.map((chip, i) => {
            const isHidden = hiddenNotes?.has(chip.internalNote) ?? false;
            const isColorNote = colorNotes?.has(chip.internalNote) ?? false;
            return (
              <li
                key={`${chip.note}-${i}`}
                className="degree-chip-item"
                data-in-scale={chip.inScale ? 'true' : undefined}
                data-is-tonic={chip.isTonic ? 'true' : undefined}
                data-hidden={isHidden ? 'true' : undefined}
                data-is-color-note={isColorNote ? 'true' : undefined}
              >
                <button
                  type="button"
                  className="degree-chip"
                  aria-pressed={isHidden}
                  aria-label={`${isHidden ? 'Show' : 'Hide'} ${chip.note}`}
                  onClick={() => onChipToggle?.(chip.internalNote)}
                  disabled={!onChipToggle}
                >
                  <span className="degree-chip-note">{chip.note}</span>
                </button>
                <span className="degree-chip-interval">{chip.interval}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
