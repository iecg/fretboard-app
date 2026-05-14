import { cva, type VariantProps } from "class-variance-authority";
import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StepperShell } from "../StepperShell/StepperShell";
import {
  SPRING_TAP,
  STEPPER_VALUE_POP_TRANSITION,
  WHILE_TAP_BTN,
} from "@fretflow/core";
import styles from "./StepperControl.module.css";
import shared from "../shared/shared.module.css";

const stepperControlVariants = cva(styles["stepper-control"], {
  variants: {
    variant: {
      toolbar: styles.toolbar,
      mobile: styles.mobile,
    },
  },
  defaultVariants: {
    variant: "toolbar",
  },
});

export type StepperControlVariant = VariantProps<typeof stepperControlVariants>["variant"];

export interface StepperControlProps {
  value: number;
  onChange: (newValue: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  formatValue?: (val: number) => string;
  buttonVariant?: StepperControlVariant;
}

export function StepperControl({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  formatValue = String,
  buttonVariant = "toolbar",
}: StepperControlProps) {
  return (
    <div className={stepperControlVariants({ variant: buttonVariant })}>
      {label && <span className={shared["section-label"]}>{label}</span>}
      <StepperShell
        className={styles["stepper-group"]}
        role="group"
        aria-label={label ?? "Stepper control"}
      >
        <motion.button
          type="button"
          className={styles["stepper-btn"]}
          aria-label={`Decrease ${label ?? "value"} (current: ${value})`}
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          whileTap={WHILE_TAP_BTN}
          transition={SPRING_TAP}
        >
          <Minus className={styles["stepper-icon"]} aria-hidden="true" />
        </motion.button>
        <div className={styles["stepper-value-slot"]}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={value}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={STEPPER_VALUE_POP_TRANSITION}
              className={styles["stepper-value"]}
            >
              {formatValue(value)}
            </motion.span>
          </AnimatePresence>
        </div>
        <motion.button
          type="button"
          className={styles["stepper-btn"]}
          aria-label={`Increase ${label ?? "value"} (current: ${value})`}
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          whileTap={WHILE_TAP_BTN}
          transition={SPRING_TAP}
        >
          <Plus className={styles["stepper-icon"]} aria-hidden="true" />
        </motion.button>
      </StepperShell>
    </div>
  );
}

export default StepperControl;
