import { type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './AppHeader.module.css';

export interface AppHeaderProps {
  brandTitle: string;
  brandSubtitle?: string;
  /** Optional SVG wordmark. When provided, replaces the text-based title
   *  rendering. `brandTitle` is still used as an accessible label. */
  brandWordmark?: ReactNode;
  brandIcon?: ReactNode;
  /** The DAW transport cluster, rendered between the brand and the utility
   *  actions so the header is the single chrome row of the always-on model. */
  transport?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Splits a CamelCase brand title (e.g., "FretFlow") into two halves so the
 * wordmark can render "Fret" in cyan and "Flow" in orange. Titles without
 * an internal capital return the whole string as the primary segment.
 */
function splitBrandTitle(title: string): [string, string] {
  const match = title.match(/^([A-Z][a-z0-9]+)([A-Z][A-Za-z0-9]*)$/);
  if (match) return [match[1], match[2]];
  return [title, ''];
}

export function AppHeader({
  brandTitle,
  brandSubtitle,
  brandWordmark,
  brandIcon,
  transport,
  actions,
  className,
}: AppHeaderProps) {
  const [titlePrimary, titleSecondary] = splitBrandTitle(brandTitle);
  return (
    <header role="banner" className={clsx(styles['app-header'], className)} data-testid="app-header">
      <div className={styles['app-header-brand']} data-testid="app-header-brand">
        {brandIcon && (
          <span className={styles['app-header-brand-icon']} aria-hidden="true">
            {brandIcon}
          </span>
        )}
        {brandWordmark ? (
          <span
            className={styles['app-header-brand-wordmark']}
            aria-label={brandTitle}
            role="img"
            data-testid="app-header-brand-wordmark"
          >
            {brandWordmark}
          </span>
        ) : (
          <span className={styles['app-header-brand-title']} data-testid="app-header-brand-title">
            <span className={styles['app-header-brand-title-primary']}>{titlePrimary}</span>
            {titleSecondary && (
              <span className={styles['app-header-brand-title-secondary']}>
                {titleSecondary}
              </span>
            )}
          </span>
        )}
        {brandSubtitle && (
          <span className={styles['app-header-brand-pill']} data-testid="app-header-brand-subtitle">
            {brandSubtitle}
          </span>
        )}
      </div>
      {transport && (
        <div className={styles['app-header-transport']} data-testid="app-header-transport">
          {transport}
        </div>
      )}
      {actions && (
        <div className={styles['app-header-actions']} data-testid="app-header-actions">
          {actions}
        </div>
      )}
    </header>
  );
}
