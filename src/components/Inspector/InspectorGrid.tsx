import type { ReactNode } from "react";
import clsx from "clsx";
import { Switch } from "../Switch/Switch";
import styles from "./InspectorGrid.module.css";

export interface PropGridProps {
  /** Number of grid columns. Defaults to 6 — the DAW inspector standard. */
  columns?: number;
  children: ReactNode;
  className?: string;
}

/** A CSS-grid container for inspector property cells. */
export function PropGrid({ columns = 6, children, className }: PropGridProps) {
  return (
    <div
      className={clsx(styles.propGrid, className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

export interface PropProps {
  /** Uppercase micro-label shown above the control. */
  label?: string;
  /** Column span within the parent PropGrid. Defaults to 1. */
  span?: number;
  /** Optional terse hint shown below the control. */
  hint?: string;
  children: ReactNode;
}

/** A labeled property cell inside a PropGrid. */
export function Prop({ label, span = 1, hint, children }: PropProps) {
  return (
    <div className={styles.prop} style={{ gridColumn: `span ${span}` }}>
      {label ? <span className={styles.propLabel}>{label}</span> : null}
      <div className={styles.propControl}>{children}</div>
      {hint ? <p className={styles.propHint}>{hint}</p> : null}
    </div>
  );
}

export interface GroupHeaderProps {
  children: ReactNode;
  /** Optional right-aligned content (e.g. action buttons). */
  right?: ReactNode;
}

/** A full-width section divider spanning every PropGrid column. */
export function GroupHeader({ children, right }: GroupHeaderProps) {
  return (
    <div className={styles.groupHeader}>
      <h3 className={styles.groupHeaderLabel}>{children}</h3>
      <span className={styles.groupHeaderRule} aria-hidden="true" />
      {right}
    </div>
  );
}

export interface TogglePropProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Optional state word shown between the label and the switch. */
  status?: string;
  /** Column span within the parent PropGrid. Defaults to 2. */
  span?: number;
}

/** An inline label + Switch row for boolean settings. */
export function ToggleProp({ label, checked, onChange, status, span = 2 }: TogglePropProps) {
  return (
    <div className={styles.toggleProp} style={{ gridColumn: `span ${span}` }}>
      <span className={styles.togglePropLabel}>{label}</span>
      {status ? <span className={styles.togglePropStatus}>{status}</span> : null}
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
