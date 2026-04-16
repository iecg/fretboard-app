import { useId } from 'react';
import clsx from 'clsx';
import { DrawerSelector } from '../DrawerSelector';
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

export function LabeledSelect({
  label,
  value,
  options,
  onChange,
  className,
  disabled,
}: LabeledSelectProps) {
  const labelId = useId();
  const displayValue = options.find(o => o.value === value)?.label ?? value;
  const drawerOptions = options.filter(o => !o.disabled).map(o => o.label);

  function handleSelect(selected: string) {
    const match = options.find(o => o.label === selected);
    if (match) onChange(match.value);
  }

  return (
    <div className={clsx('labeled-select', { 'labeled-select--disabled': disabled }, className)}>
      <span className="labeled-select-label" id={labelId}>
        {label}
      </span>
      <div className="labeled-select-field" aria-labelledby={labelId}>
        <DrawerSelector
          label={label}
          value={displayValue}
          options={drawerOptions}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
