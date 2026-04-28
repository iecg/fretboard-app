import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import styles from "./StepperShell.module.css";

export interface StepperShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function StepperShell({
  className,
  children,
  ...props
}: StepperShellProps) {
  return (
    <div className={clsx(styles.shell, className)} {...props}>
      {children}
    </div>
  );
}

export default StepperShell;
