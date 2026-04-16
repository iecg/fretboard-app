import clsx from 'clsx';
import './DegreeChipStrip.css';

export interface DegreeChip {
  note: string;
  interval: string;
  inScale: boolean;
  isTonic?: boolean;
  inChord?: boolean;
}

export interface DegreeChipStripProps {
  scaleName: string;
  chips: DegreeChip[];
  className?: string;
  'aria-label'?: string;
}

export function DegreeChipStrip({
  scaleName,
  chips,
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
        {chips.map((chip, i) => (
          <li
            key={`${chip.note}-${i}`}
            className="degree-chip-item"
            data-in-scale={chip.inScale ? 'true' : undefined}
            data-is-tonic={chip.isTonic ? 'true' : undefined}
            data-in-chord={chip.inChord ? 'true' : undefined}
          >
            <span className="degree-chip-interval">{chip.interval}</span>
            <span className="degree-chip">
              <span className="degree-chip-note">{chip.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
