import clsx from 'clsx';
import './DegreeChipStrip.css';

export interface DegreeChip {
  note: string;
  internalNote: string;
  interval: string;
  inScale: boolean;
  isTonic?: boolean;
  inChord?: boolean;
}

export interface DegreeChipStripProps {
  scaleName: string;
  chips: DegreeChip[];
  hiddenNotes?: Set<string>;
  onChipToggle?: (internalNote: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function DegreeChipStrip({
  scaleName,
  chips,
  hiddenNotes,
  onChipToggle,
  className,
  'aria-label': ariaLabel,
}: DegreeChipStripProps) {
  const label = ariaLabel ?? `Scale degrees for ${scaleName}`;

  return (
    <section
      role="group"
      aria-label={label}
      className={clsx('degree-chip-strip', className)}
    >
      <header className="degree-chip-strip-header">{scaleName}</header>
      <ul className="degree-chip-strip-list">
        {chips.map((chip, i) => {
          const isHidden = hiddenNotes?.has(chip.internalNote) ?? false;
          return (
            <li
              key={`${chip.note}-${i}`}
              className="degree-chip-item"
              data-in-scale={chip.inScale ? 'true' : undefined}
              data-is-tonic={chip.isTonic ? 'true' : undefined}
              data-in-chord={chip.inChord ? 'true' : undefined}
              data-hidden={isHidden ? 'true' : undefined}
            >
              <button
                type="button"
                className="degree-chip"
                aria-pressed={isHidden}
                aria-label={`${isHidden ? 'Show' : 'Hide'} ${chip.note}`}
                onClick={() => onChipToggle?.(chip.internalNote)}
              >
                <span className="degree-chip-note">{chip.note}</span>
              </button>
              <span className="degree-chip-interval">{chip.interval}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
