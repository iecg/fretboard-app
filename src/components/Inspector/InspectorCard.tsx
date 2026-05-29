import type { ReactNode } from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { Switch } from "../Switch/Switch";
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
   * the card shows a `locked` data attribute. Independent of `active` (which
   * dims the body via the master toggle). Typically paired with `overlay` to
   * communicate why the card is locked.
   */
  locked?: boolean;
  /**
   * Optional overlay rendered inside the card body when the card is locked
   * during playback. Absolutely positioned on top of the body content with
   * backdrop blur. Replaces the earlier `lockedHint` approach (which caused
   * layout shift by swapping description text).
   */
  overlay?: ReactNode;
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
  overlay,
  children,
}: InspectorCardProps) {
  const hasToggle = onToggle !== undefined && toggleLabel !== undefined && active !== undefined;
  // When there's no master toggle, `data-active` stays "true" — body never dims.
  const isActive = hasToggle ? active : true;

  return (
    <section
      className={styles.card}
      data-active={isActive ? "true" : "false"}
      data-locked={locked ? "true" : undefined}
      aria-labelledby={labelledById}
    >
      <header className={clsx(styles.cardHead, headClassName)}>
        {hasToggle ? (
          <Switch label={toggleLabel} checked={active} onChange={onToggle} />
        ) : null}
        <h3 id={labelledById} className={styles.cardName}>
          {name}
        </h3>
        {locked ? (
          <Lock size={11} className={styles.lockIcon} aria-hidden="true" />
        ) : null}
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
        {actions ? (
          <div
            className={styles.cardHeadActions}
            inert={locked || undefined}
            data-locked={locked ? "true" : undefined}
          >
            {actions}
          </div>
        ) : null}
      </header>
      <div
        className={clsx(styles.cardBody, bodyClassName)}
        data-locked={locked ? "true" : undefined}
        inert={locked || undefined}
      >
        {children}
      </div>
      {overlay ? (
        <div className={styles.cardBodyOverlay} role="status" aria-live="polite">
          {overlay}
        </div>
      ) : null}
    </section>
  );
}
