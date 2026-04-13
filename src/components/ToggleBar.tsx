import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
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

interface ToggleBarProps extends VariantProps<typeof toggleBarVariants> {
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (value: string | number) => void;
  variant?: "default" | "tabs";
}

export function ToggleBar({
  options,
  value,
  onChange,
  variant = "default",
}: ToggleBarProps) {
  return (
    <div className={toggleBarVariants({ variant })}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            className={clsx(
              toggleButtonVariants({ variant, isActive })
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
