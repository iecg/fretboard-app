import clsx from "clsx";
import type { KeyboardEvent } from "react";
import styles from "./Switch.module.css";

export type SwitchTone = "cyan" | "warm";

export interface SwitchProps {
  /** Current checked state. Controlled. */
  checked: boolean;
  /** Called with the new checked value when the user toggles. */
  onChange: (checked: boolean) => void;
  /** Accessible name. Renders as aria-label on the underlying button. */
  label: string;
  /** Visual variant. Defaults to "cyan". Use "warm" for chord-selected context. */
  tone?: SwitchTone;
  /** Disabled state — no user input fires onChange. */
  disabled?: boolean;
  /** Optional id for label association. */
  id?: string;
  /** Optional extra class. */
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  tone = "cyan",
  disabled = false,
  id,
  className,
}: SwitchProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onChange(!checked);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-on={checked ? "" : undefined}
      data-tone={tone}
      className={clsx(styles.switch, className)}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
    />
  );
}
