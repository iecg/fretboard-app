import { type ReactNode, useId } from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

export interface CardProps {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div';
  'aria-labelledby'?: string;
  'aria-label'?: string;
}

interface CardHeaderProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  id?: string;
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

function CardHeader({ title, icon, action, id }: CardHeaderProps) {
  return (
    <div className={styles['card-header']}>
      <div className={styles['card-header-title-row']}>
        {icon && <span className={styles['card-header-icon']} aria-hidden="true">{icon}</span>}
        <h2 className={styles['card-header-title']} id={id}>{title}</h2>
      </div>
      {action && <div className={styles['card-header-action']}>{action}</div>}
    </div>
  );
}

function CardBody({ children, className }: CardBodyProps) {
  return (
    <div className={clsx(styles['card-body'], className)}>
      {children}
    </div>
  );
}

export function Card({
  title,
  icon,
  action,
  children,
  className,
  as: As = 'section',
  'aria-labelledby': ariaLabelledBy,
  'aria-label': ariaLabel,
  ...rest
}: CardProps & React.HTMLAttributes<HTMLElement>) {
  const generatedId = useId();
  const headerId = title ? generatedId : undefined;

  if (import.meta.env.DEV && !title && !ariaLabel && !ariaLabelledBy) {
    console.warn('[Card] Missing accessible name: provide `title`, `aria-label`, or `aria-labelledby`.');
  }

  const labelledBy = title ? (ariaLabelledBy ?? headerId) : ariaLabelledBy;

  return (
    <As
      className={clsx(styles.card, "dashboard-card", className)}
      aria-labelledby={labelledBy}
      aria-label={!title ? ariaLabel : undefined}
      {...rest}
    >
      {title && <CardHeader title={title} icon={icon} action={action} id={headerId} />}
      <CardBody>{children}</CardBody>
    </As>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
