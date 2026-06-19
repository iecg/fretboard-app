import { useId } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { ANIMATION_DURATION_FAST } from "@fretflow/core";
import styles from "./ToggleBar.module.css";
import shared from "../shared/shared.module.css";
// Each variant supplies its OWN group class. `default` and `chip` opt into the
// shared `toggle-group` base chrome; `tabs` is fully self-contained (no group
// container), so the base is NOT applied globally.
function getToggleBarClass(variant: ToggleBarVariant = "default") {
  switch (variant) {
    case "tabs":
      return styles["mobile-tab-bar"];
    case "chip":
      return `${shared["toggle-group"]} ${shared["toggle-group--chip"]}`;
    case "default":
    default:
      return `${shared["toggle-group"]} ${shared["toggle-group--default"]}`;
  }
}

function getToggleButtonClass(variant: ToggleBarVariant = "default", isActive: boolean) {
  let base = shared["toggle-btn"];
  if (variant === "tabs") base = styles["mobile-tab"];
  else if (variant === "chip") base = `${shared["toggle-btn"]} ${shared["toggle-btn--chip"]}`;

  return clsx(base, isActive && shared.active);
}

export type ToggleBarVariant = "default" | "chip" | "tabs";

type ToggleBarOption<Value extends string | number> = {
  value: Value;
  label: string;
  disabled?: boolean;
  title?: string;
  /** Accessible description announced after the button name by screen readers. */
  description?: string;
};

interface ToggleBarProps<Value extends string | number> {
  variant?: ToggleBarVariant;
  options: readonly ToggleBarOption<Value>[];
  value: Value | undefined;
  onChange: (value: Value) => void;
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
  const isTablist = variant === "tabs";
  const descPrefix = useId();
  return (
    <div
      className={getToggleBarClass(variant)}
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
            className={getToggleButtonClass(variant, isActive)}
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
