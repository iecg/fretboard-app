import { useId } from 'react';
import clsx from 'clsx';
import styles from './LabeledSelect.module.css';

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
    <div className={clsx(styles['labeled-select'], { [styles['labeled-select--disabled']]: disabled, [styles['labeled-select--hide-label']]: hideLabel }, className)}>
      <label className={styles['labeled-select-label']} htmlFor={selectId}>
        <span className={styles['labeled-select-label-text']}>{label}</span>
        <div className={styles['labeled-select-field']}>
          <select
            id={selectId}
            className={styles['labeled-select-native']}
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
          <span className={styles['labeled-select-chevron']} aria-hidden="true">
            ▾
          </span>
        </div>
      </label>
    </div>
  );
}
