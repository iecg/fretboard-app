import type { ReactNode } from 'react';
import clsx from 'clsx';
import type { ScaleVisibilityMode } from '../store/atoms';
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
  className?: string;
  'aria-label'?: string;
  hideHeader?: boolean;
  /** Controls chip interactivity and list visibility. */
  mode?: ScaleVisibilityMode;
  /** Rendered inside the header landmark, to the right of the scale name. */
  headerAction?: ReactNode;
}

export function DegreeChipStrip({
  scaleName,
  chips,
  hiddenNotes,
  onChipToggle,
  className,
  'aria-label': ariaLabel,
  hideHeader,
  mode = 'all',
  headerAction,
}: DegreeChipStripProps) {
  const label = ariaLabel ?? `Scale degrees for ${scaleName}`;
  const showChips = mode !== 'off';

  return (
    <section
      role="group"
      aria-label={label}
      className={clsx('degree-chip-strip', className)}
      data-visibility-mode={mode}
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
      {showChips && (
        <ul className="degree-chip-strip-list">
          {chips.map((chip, i) => {
            const isHidden = hiddenNotes?.has(chip.internalNote) ?? false;
            return (
              <li
                key={`${chip.note}-${i}`}
                className="degree-chip-item"
                data-in-scale={chip.inScale ? 'true' : undefined}
                data-is-tonic={chip.isTonic ? 'true' : undefined}
                data-hidden={isHidden ? 'true' : undefined}
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
