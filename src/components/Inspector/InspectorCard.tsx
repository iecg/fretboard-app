import type { ReactNode } from "react";
import clsx from "clsx";
import { Switch } from "../Switch/Switch";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./InspectorCard.module.css";

export interface InspectorCardProps {
  /** Section name (uppercased in the header). Becomes the h3 text. */
  name: string;
  /** Optional one-line description shown next to the name (truncated on overflow, hidden on mobile). */
  description?: string;
  /** ID applied to the h3 — used as the section's aria-labelledby anchor. */
  labelledById: string;
  /**
   * Master visibility state. When provided along with `onToggle` + `toggleLabel`,
   * the card renders a Switch at the head's leading edge and dims its body when
   * `active === false`. Omit for cards that have no master toggle (Key, Time,
   * Progression).
   */
  active?: boolean;
  onToggle?: (next: boolean) => void;
  toggleLabel?: string;
  /** "Showing" / "Hidden" chip; only rendered when present. */
  stateLabel?: string;
  /** Right-aligned content (toolbar buttons, etc). */
  actions?: ReactNode;
  /** Optional class merged onto the body (e.g. for cards that want full-bleed). */
  bodyClassName?: string;
  /** Optional class merged onto the header (e.g. for cards that want tighter vertical padding). */
  headClassName?: string;
  /**
   * When true, the card body becomes non-interactive (HTML5 `inert`) and
   * visually dims. Pair with `lockedHint` to show a tooltip explaining
   * how the user unlocks. Independent of `active` (which dims the body
   * via the master toggle).
   */
  locked?: boolean;
  /** Tooltip content shown when hovering the locked body. Required when `locked=true`. */
  lockedHint?: ReactNode;
  /** Card body contents — typically a PropGrid. */
  children: ReactNode;
}

/**
 * Variant B sectioned card: a bordered, rounded panel whose header bar carries
 * a section name + optional description and either a master visibility toggle
 * (Overlay tab — Scale / Chord) or a right-side actions slot (Song tab —
 * Progression toolbar) or neither (Song tab — Key / Time / BackingTrack). The
 * body dims to 42% opacity when a master toggle is provided and turned off,
 * giving immediate cause-and-effect feedback.
 *
 * Shared across `ViewTab` (Overlay) and `SongControls` (Song).
 */
export function InspectorCard({
  name,
  description,
  labelledById,
  active,
  onToggle,
  toggleLabel,
  stateLabel,
  actions,
  bodyClassName,
  headClassName,
  locked = false,
  lockedHint,
  children,
}: InspectorCardProps) {
  const hasToggle = onToggle !== undefined && toggleLabel !== undefined && active !== undefined;
  // When there's no master toggle, `data-active` stays "true" — body never dims.
  const isActive = hasToggle ? active : true;

  const body = (
    <div
      className={clsx(styles.cardBody, bodyClassName)}
      data-locked={locked ? "true" : undefined}
      // React 19 treats `inert` as a boolean attribute: pass `true` to add the
      // attribute (rendered as inert="" in the DOM), omit/false to remove it.
      inert={locked || undefined}
    >
      {children}
    </div>
  );

  return (
    <section
      className={styles.card}
      data-active={isActive ? "true" : "false"}
      aria-labelledby={labelledById}
    >
      <header className={clsx(styles.cardHead, headClassName)}>
        {hasToggle ? (
          <Switch label={toggleLabel} checked={active} onChange={onToggle} />
        ) : null}
        <h3 id={labelledById} className={styles.cardName}>
          {name}
        </h3>
        {stateLabel ? (
          <span className={styles.cardState} aria-hidden="true">
            {stateLabel}
          </span>
        ) : null}
        {description ? (
          <span className={styles.cardDesc}>{description}</span>
        ) : (
          <span className={styles.cardDesc} aria-hidden="true" />
        )}
        {actions ? <div className={styles.cardHeadActions}>{actions}</div> : null}
      </header>
      {locked && lockedHint ? (
        <Tooltip content={lockedHint}>
          <div tabIndex={-1}>{body}</div>
        </Tooltip>
      ) : (
        body
      )}
    </section>
  );
}
