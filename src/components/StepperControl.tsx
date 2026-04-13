import clsx from "clsx";
import "./StepperControl.css";

export interface StepperControlProps {
  value: number;
  onChange: (newValue: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  formatValue?: (val: number) => string;
  buttonVariant?: "toolbar" | "mobile";
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
    <div className={clsx("stepper-control", buttonVariant)}>
      {label && <span className="section-label">{label}</span>}
      <div className="stepper-group">
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
        >
          −
        </button>
        <span className="stepper-value">{formatValue(value)}</span>
        <button
          type="button"
          className="stepper-btn"
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
