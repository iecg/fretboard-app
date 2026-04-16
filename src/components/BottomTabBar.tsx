import { type ReactNode, useRef, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import './BottomTabBar.css';

export interface BottomTabItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
  disabled?: boolean;
}

export interface BottomTabBarProps {
  items: BottomTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  'aria-label'?: string;
  className?: string;
}

export function BottomTabBar({
  items,
  activeId,
  onSelect,
  'aria-label': ariaLabel = 'Primary navigation',
  className,
}: BottomTabBarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const enabledIndexes = items
      .map((item, i) => (item.disabled ? null : i))
      .filter((i): i is number => i !== null);

    if (enabledIndexes.length === 0) return;

    let currentEnabledPos = enabledIndexes.indexOf(index);
    if (currentEnabledPos === -1) currentEnabledPos = 0;

    let targetIndex: number | null = null;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextPos = (currentEnabledPos + 1) % enabledIndexes.length;
      targetIndex = enabledIndexes[nextPos];
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevPos = (currentEnabledPos - 1 + enabledIndexes.length) % enabledIndexes.length;
      targetIndex = enabledIndexes[prevPos];
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetIndex = enabledIndexes[0];
    } else if (e.key === 'End') {
      e.preventDefault();
      targetIndex = enabledIndexes[enabledIndexes.length - 1];
    }

    if (targetIndex != null && tabRefs.current[targetIndex]) {
      tabRefs.current[targetIndex]?.focus();
      onSelect(items[targetIndex].id);
    }
  }

  return (
    <nav aria-label={ariaLabel} className={clsx('bottom-tab-bar', className)}>
      <div role="tablist" className="bottom-tab-bar-list">
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              aria-selected={isActive}
              aria-label={item.label}
              tabIndex={isActive ? 0 : -1}
              disabled={item.disabled}
              className={clsx('bottom-tab-bar-btn', { 'is-active': isActive })}
              onClick={() => !item.disabled && onSelect(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <span className="bottom-tab-bar-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="bottom-tab-bar-label">{item.label}</span>
              {item.badge != null && (
                <span className="bottom-tab-bar-badge" aria-label={`${item.badge} notifications`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
