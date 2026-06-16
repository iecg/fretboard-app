import { cva, type VariantProps } from "class-variance-authority";
import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
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

type StepperControlVariant = VariantProps<typeof stepperControlVariants>["variant"];

export interface StepperControlProps {
  value: number;
  onChange: (newValue: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  /** When true, the visible label is omitted but `label` still feeds the
   * group/button accessible names. Use inside a `Prop` cell that already
   * supplies a visible label. */
  hideLabel?: boolean;
  formatValue?: (val: number) => string;
  buttonVariant?: StepperControlVariant;
  /** Optional test hook forwarded to the StepperShell group element. */
  testId?: string;
  /** Sizing mode for the stepper control. Defaults to "auto" (fit-content). */
  width?: "fill" | "auto";
  /** When true, both stepper buttons are disabled regardless of value bounds. */
  disabled?: boolean;
  /** When set, the stepper group element gets this DOM id and becomes
   * programmatically focusable (tabIndex=-1) so global keyboard shortcuts can
   * focus it. Does not add a Tab stop — the +/- buttons remain the tab stops. */
  groupId?: string;
}

export function StepperControl({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  hideLabel = false,
  formatValue = String,
  buttonVariant = "toolbar",
  testId,
  width,
  disabled = false,
  groupId,
}: StepperControlProps) {
  return (
    <div
      className={clsx(
        stepperControlVariants({ variant: buttonVariant }),
        { [styles["stepper-control--fill"]]: width === "fill" }
      )}
    >
      {label && !hideLabel && <span className={shared["section-label"]}>{label}</span>}
      <StepperShell
        className={styles["stepper-group"]}
        role="group"
        aria-label={label ?? "Stepper control"}
        data-testid={testId}
        id={groupId}
        tabIndex={groupId ? -1 : undefined}
      >
        <motion.button
          type="button"
          className={styles["stepper-btn"]}
          aria-label={`Decrease ${label ?? "value"} (current: ${value})`}
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={disabled || value <= min}
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
          disabled={disabled || value >= max}
          whileTap={WHILE_TAP_BTN}
          transition={SPRING_TAP}
        >
          <Plus className={styles["stepper-icon"]} aria-hidden="true" />
        </motion.button>
      </StepperShell>
    </div>
  );
}
