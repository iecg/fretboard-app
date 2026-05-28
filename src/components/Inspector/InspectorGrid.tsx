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

/**
 * A CSS-grid container for inspector property cells. The column count is
 * emitted as the `data-columns` attribute so the stylesheet owns the track
 * template and can override it responsively (the mobile tier collapses to
 * two columns).
 */
export function PropGrid({ columns = 6, children, className }: PropGridProps) {
  return (
    <div className={clsx(styles.propGrid, className)} data-columns={columns}>
      {children}
    </div>
  );
}

export interface PropProps {
  /** Uppercase micro-label shown above the control. */
  label?: string;
  /** Optional right-aligned content in the same row as the label. */
  labelAccessory?: ReactNode;
  /** Column span within the parent PropGrid. Defaults to 1. */
  span?: number;
  /** Optional terse hint shown below the control. */
  hint?: string;
  /** Optional class applied to the control wrapper for local alignment tweaks. */
  controlClassName?: string;
  children: ReactNode;
}

/**
 * A labeled property cell inside a PropGrid. The column span is emitted as
 * `data-span` so the stylesheet owns the `grid-column` rule — that lets the
 * mobile tier clamp wide cells to the two available tracks instead of letting
 * the span spill into implicit columns.
 */
export function Prop({
  label,
  labelAccessory,
  span = 1,
  hint,
  controlClassName,
  children,
}: PropProps) {
  return (
    <div className={styles.prop} data-span={span}>
      {label || labelAccessory ? (
        <span className={styles.propLabelRow}>
          {label ? <span className={styles.propLabel}>{label}</span> : null}
          {labelAccessory ? (
            <span className={styles.propLabelAccessory}>{labelAccessory}</span>
          ) : null}
        </span>
      ) : null}
      <div className={clsx(styles.propControl, controlClassName)}>{children}</div>
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
    <div className={styles.toggleProp} data-span={span}>
      <span className={styles.togglePropLabel}>{label}</span>
      {status ? <span className={styles.togglePropStatus}>{status}</span> : null}
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
