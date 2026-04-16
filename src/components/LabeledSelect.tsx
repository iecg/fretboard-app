import { type ChangeEvent, useId } from 'react';
import clsx from 'clsx';
import './LabeledSelect.css';

export interface LabeledSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface LabeledSelectProps {
  label: string;
  value: string;
  options: LabeledSelectOption[];
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
  disabled?: boolean;
}

function ChevronIcon() {
  return (
    <svg
      className="labeled-select-chevron"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LabeledSelect({
  label,
  value,
  options,
  onChange,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  disabled,
}: LabeledSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange(e.target.value);
  }

  return (
    <div className={clsx('labeled-select', { 'labeled-select--disabled': disabled }, className)}>
      <label className="labeled-select-label" htmlFor={selectId}>
        {label}
      </label>
      <div className="labeled-select-field">
        <select
          id={selectId}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
          className="labeled-select-native"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
    </div>
  );
}
