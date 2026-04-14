import { cva, type VariantProps } from "class-variance-authority";
import "./ToggleBar.css";

const toggleBarVariants = cva("toggle-group", {
  variants: {
    variant: {
      default: "toggle-group--default",
      tabs: "mobile-tab-bar",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const toggleButtonVariants = cva("", {
  variants: {
    variant: {
      default: "toggle-btn",
      tabs: "mobile-tab",
    },
    isActive: {
      true: "active",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    isActive: false,
  },
});

type ToggleBarOption<Value extends string | number> = {
  value: Value;
  label: string;
};

interface ToggleBarProps<Value extends string | number> extends VariantProps<
  typeof toggleBarVariants
> {
  options: readonly ToggleBarOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  variant?: "default" | "tabs";
}

export function ToggleBar<Value extends string | number>({
  options,
  value,
  onChange,
  variant = "default",
}: ToggleBarProps<Value>) {
  return (
    <div className={toggleBarVariants({ variant })}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            className={toggleButtonVariants({ variant, isActive })}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
