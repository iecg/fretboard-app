import { type ReactNode } from 'react';
import clsx from 'clsx';
import './AppHeader.css';

export interface AppHeaderProps {
  brandTitle: string;
  brandSubtitle?: string;
  brandIcon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AppHeader({
  brandTitle,
  brandSubtitle,
  brandIcon,
  actions,
  className,
}: AppHeaderProps) {
  return (
    <header role="banner" className={clsx('app-header', className)}>
      <div className="app-header-brand">
        {brandIcon && (
          <span className="app-header-brand-icon" aria-hidden="true">
            {brandIcon}
          </span>
        )}
        <div className="app-header-brand-text">
          <span className="app-header-brand-title">{brandTitle}</span>
          {brandSubtitle && (
            <span className="app-header-brand-subtitle">{brandSubtitle}</span>
          )}
        </div>
      </div>
      {actions && (
        <div className="app-header-actions">
          {actions}
        </div>
      )}
    </header>
  );
}
