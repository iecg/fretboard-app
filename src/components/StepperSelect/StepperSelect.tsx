import { motion } from "motion/react";
import {
  LabeledSelect,
  type LabeledSelectOption,
} from "../LabeledSelect/LabeledSelect";
import { StepperShell } from "../StepperShell/StepperShell";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SPRING_TAP, WHILE_TAP_BTN } from "@fretflow/core";
import styles from "./StepperSelect.module.css";

export interface StepperSelectProps {
  value: string;
  options: LabeledSelectOption[];
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
    <StepperShell
      className={styles["stepper-select"]}
      role="group"
      aria-label={groupLabel}
    >
      <motion.button
        type="button"
        className={styles["nav-button"]}
        onClick={onPrevious}
        aria-label={previousLabel}
        disabled={disabled || previousDisabled}
        whileTap={WHILE_TAP_BTN}
        transition={SPRING_TAP}
      >
        <ChevronLeft className="icon" size={16} />
      </motion.button>
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
      <motion.button
        type="button"
        className={styles["nav-button"]}
        onClick={onNext}
        aria-label={nextLabel}
        disabled={disabled || nextDisabled}
        whileTap={WHILE_TAP_BTN}
        transition={SPRING_TAP}
      >
        <ChevronRight className="icon" size={16} />
      </motion.button>
    </StepperShell>
  );
}
