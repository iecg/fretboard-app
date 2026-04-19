import { cva, type VariantProps } from "class-variance-authority";
import "./ToggleBar.css";
import shared from "./shared.module.css";

const toggleBarVariants = cva(shared["toggle-group"], {
  variants: {
    variant: {
      default: shared["toggle-group--default"],
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
      default: shared["toggle-btn"],
      tabs: "mobile-tab",
    },
    isActive: {
      true: shared.active,
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
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
};

interface ToggleBarProps<Value extends string | number> extends VariantProps<
  typeof toggleBarVariants
> {
  options: readonly ToggleBarOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  variant?: "default" | "tabs";
  label?: string;
}

export function ToggleBar<Value extends string | number>({
  options,
  value,
  onChange,
  variant = "default",
  label,
}: ToggleBarProps<Value>) {
  const isTabs = variant === "tabs";
  return (
    <div
      className={toggleBarVariants({ variant })}
      role={isTabs ? "tablist" : "group"}
      aria-label={label}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            {...(isTabs
              ? { role: "tab", "aria-selected": isActive }
              : { "aria-pressed": isActive })}
            className={toggleButtonVariants({ variant, isActive })}
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
            title={option.title}
            aria-label={option.ariaLabel}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
