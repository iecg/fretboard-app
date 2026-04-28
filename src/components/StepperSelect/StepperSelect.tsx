import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  LabeledSelect,
  type LabeledSelectOption,
} from "../LabeledSelect/LabeledSelect";
import styles from "./StepperSelect.module.css";

export type StepperSelectOption = LabeledSelectOption;

export interface StepperSelectProps {
  value: string;
  options: StepperSelectOption[];
  onChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  selectLabel: string;
  groupLabel: string;
  previousLabel: string;
  nextLabel: string;
  disabled?: boolean;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}

export function StepperSelect({
  value,
  options,
  onChange,
  onPrevious,
  onNext,
  selectLabel,
  groupLabel,
  previousLabel,
  nextLabel,
  disabled = false,
  previousDisabled = false,
  nextDisabled = false,
}: StepperSelectProps) {
  return (
    <div
      className={styles["stepper-select"]}
      role="group"
      aria-label={groupLabel}
    >
      <button
        type="button"
        className={styles["nav-button"]}
        onClick={onPrevious}
        aria-label={previousLabel}
        disabled={disabled || previousDisabled}
      >
        <ChevronLeft className="icon" size={16} />
      </button>
      <div className={styles["select-slot"]}>
        <LabeledSelect
          label={selectLabel}
          value={value}
          options={options}
          onChange={onChange}
          hideLabel
          disabled={disabled}
        />
      </div>
      <button
        type="button"
        className={styles["nav-button"]}
        onClick={onNext}
        aria-label={nextLabel}
        disabled={disabled || nextDisabled}
      >
        <ChevronRight className="icon" size={16} />
      </button>
    </div>
  );
}
