import { useId } from "react";
import { motion } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import styles from "./ToggleBar.module.css";
import shared from "../shared/shared.module.css";

const toggleBarVariants = cva(shared["toggle-group"], {
  variants: {
    variant: {
      default: shared["toggle-group--default"],
      tabs: styles["mobile-tab-bar"],
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
      tabs: styles["mobile-tab"],
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
  /** Accessible description announced after the button name by screen readers. */
  description?: string;
};

interface ToggleBarProps<Value extends string | number> extends VariantProps<
  typeof toggleBarVariants
> {
  options: readonly ToggleBarOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  variant?: "default" | "tabs";
  label?: string;
  /** Compact mode — tighter padding, smaller hit-areas, smaller font. */
  compact?: boolean;
  /** When "scroll" — the toggle group scrolls horizontally instead of shrinking buttons. */
  overflow?: "scroll";
}

export function ToggleBar<Value extends string | number>({
  options,
  value,
  onChange,
  variant = "default",
  label,
  compact = false,
  overflow,
}: ToggleBarProps<Value>) {
  const isTabs = variant === "tabs";
  const descPrefix = useId();
  return (
    <div
      className={toggleBarVariants({ variant })}
      role={isTabs ? "tablist" : "group"}
      aria-label={label}
      data-compact={compact ? "true" : undefined}
      data-overflow={overflow ?? undefined}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const descId = option.description ? `${descPrefix}-${option.value}` : undefined;
        return (
          <motion.button
            key={option.value}
            type="button"
            {...(isTabs
              ? { role: "tab", "aria-selected": isActive }
              : { "aria-pressed": isActive })}
            className={toggleButtonVariants({ variant, isActive })}
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
            title={option.title}
            aria-describedby={descId}
            whileTap={{ scale: 0.96 }}
            animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {option.label}
          </motion.button>
        );
      })}
      {options.map((option) =>
        option.description ? (
          <span
            key={`desc-${option.value}`}
            id={`${descPrefix}-${option.value}`}
            className={shared["sr-only"]}
          >
            {option.description}
          </span>
        ) : null,
      )}
    </div>
  );
}
