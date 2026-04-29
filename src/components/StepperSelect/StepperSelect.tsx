import {
  LabeledSelect,
  type LabeledSelectOption,
} from "../LabeledSelect/LabeledSelect";
import { StepperShell } from "../StepperShell/StepperShell";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  /** Compact mode — tighter padding and smaller hit-areas for space-constrained layouts. */
  compact?: boolean;
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
  compact = false,
}: StepperSelectProps) {
  return (
    <StepperShell
      className={styles["stepper-select"]}
      role="group"
      aria-label={groupLabel}
      data-compact={compact ? "true" : undefined}
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
    </StepperShell>
  );
}
