import { useId } from 'react';
import clsx from 'clsx';
import './LabeledSelect.module.css';

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
  hideLabel?: boolean;
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
  hideLabel,
}: LabeledSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={clsx('labeled-select', { 'labeled-select--disabled': disabled, 'labeled-select--hide-label': hideLabel }, className)}>
      <label className="labeled-select-label" htmlFor={selectId}>
        <span className="labeled-select-label-text">{label}</span>
        <div className="labeled-select-field">
          <select
            id={selectId}
            className="labeled-select-native"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
          >
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <span className="labeled-select-chevron" aria-hidden="true">
            ▾
          </span>
        </div>
      </label>
    </div>
  );
}
