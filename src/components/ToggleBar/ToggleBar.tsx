import { useId } from "react";
import { motion } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { ANIMATION_DURATION_FAST } from "@fretflow/core";
import styles from "./ToggleBar.module.css";
import shared from "../shared/shared.module.css";

// Each variant supplies its OWN group class. `default` and `chip` opt into the
// shared `toggle-group` base chrome; `tabs` and `pip` are fully self-contained
// (they intentionally have no group container), so the base is NOT applied
// globally — that previously leaked dc-* container chrome onto the pip row.
const toggleBarVariants = cva("", {
  variants: {
    variant: {
      default: `${shared["toggle-group"]} ${shared["toggle-group--default"]}`,
      chip: `${shared["toggle-group"]} ${shared["toggle-group--chip"]}`,
      tabs: styles["mobile-tab-bar"],
      pip: styles["pip-group"],
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
      chip: `${shared["toggle-btn"]} ${shared["toggle-btn--chip"]}`,
      tabs: styles["mobile-tab"],
      pip: styles["pip-btn"],
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
  value: Value | undefined;
  onChange: (value: Value) => void;
  variant?: "default" | "chip" | "tabs" | "pip";
  label?: string;
  /** When "scroll" — the toggle group scrolls horizontally instead of shrinking buttons. */
  overflow?: "scroll";
  /** When true, every option button is disabled regardless of per-option `disabled`. */
  disabled?: boolean;
}

export function ToggleBar<Value extends string | number>({
  options,
  value,
  onChange,
  variant = "default",
  label,
  overflow,
  disabled = false,
}: ToggleBarProps<Value>) {
  const isTablist = variant === "tabs" || variant === "pip";
  const descPrefix = useId();
  return (
    <div
      className={toggleBarVariants({ variant })}
      role={isTablist ? "tablist" : "group"}
      aria-label={label}
      data-overflow={overflow ?? undefined}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const descId = option.description ? `${descPrefix}-${option.value}` : undefined;
        return (
          <motion.button
            key={option.value}
            type="button"
            {...(isTablist
              ? { role: "tab", "aria-selected": isActive }
              : { "aria-pressed": isActive })}
            className={toggleButtonVariants({ variant, isActive })}
            onClick={() => onChange(option.value)}
            disabled={disabled || option.disabled}
            title={option.title}
            aria-describedby={descId}
            whileTap={{ scale: 0.96 }}
            animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: ANIMATION_DURATION_FAST }}
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
