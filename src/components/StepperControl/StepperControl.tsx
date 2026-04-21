import { cva, type VariantProps } from "class-variance-authority";
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
      <div
        className={styles["stepper-group"]}
        role="group"
        aria-label={label ?? 'Stepper control'}
      >
        <button
          type="button"
          className={styles["stepper-btn"]}
          aria-label={`Decrease ${label ?? 'value'} (current: ${value})`}
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
        >
          −
        </button>
        <span className={styles["stepper-value"]}>{formatValue(value)}</span>
        <button
          type="button"
          className={styles["stepper-btn"]}
          aria-label={`Increase ${label ?? 'value'} (current: ${value})`}
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default StepperControl;
