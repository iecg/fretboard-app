import * as RadixSwitch from "@radix-ui/react-switch";
import clsx from "clsx";
import styles from "./Switch.module.css";

type SwitchTone = "cyan" | "warm";

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
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      data-tone={tone}
      className={clsx(styles.switch, className)}
    >
      <RadixSwitch.Thumb className={styles.thumb} />
    </RadixSwitch.Root>
  );
}
