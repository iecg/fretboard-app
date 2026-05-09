import React from 'react';
import { FloatingPortal, FloatingArrow, type Placement } from '@floating-ui/react';
import { motion, AnimatePresence } from 'motion/react';
import { useFloatingTooltipBase } from './useFloatingTooltipBase';
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from '../../../core/constants';
import styles from './Coachmark.module.css';

interface CoachmarkProps {
  children: React.ReactElement;
  content: React.ReactNode;
  dismissed: boolean;
  onDismiss: () => void;
  placement?: Placement;
}

export function Coachmark({
  children,
  content,
  dismissed,
  onDismiss,
  placement = 'bottom',
}: CoachmarkProps) {
  const open = !dismissed;

  // onOpenChange bridges useFloating's close events (e.g. Escape key via useDismiss) to onDismiss
  const { refs, floatingStyles, context, arrowRef, getFloatingProps } = useFloatingTooltipBase({
    open,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) {
        onDismiss();
      }
    },
    placement,
    role: 'dialog',
  });

  // eslint-disable-next-line react-hooks/refs
  const trigger = React.cloneElement(children, {
    // eslint-disable-next-line react-hooks/refs
    ref: refs.setReference,
  } as React.HTMLAttributes<HTMLElement> & { ref: unknown });

  return (
    <>
      {trigger}
      <FloatingPortal>
        <AnimatePresence>
          {!dismissed && (
            <motion.div
              role="status"
              aria-live="polite"
              aria-label="Settings tip"
              data-testid="settings-coach-mark"
              // eslint-disable-next-line react-hooks/refs
              ref={refs.setFloating}
              style={floatingStyles}
              className={styles.coachmark}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
              {...getFloatingProps()}
            >
              <div className={styles['coach-mark-text']}>{content}</div>
              <button
                type="button"
                className={styles['coach-mark-close']}
                aria-label="Dismiss settings tip"
                onClick={onDismiss}
              >
                ✕
              </button>
              <FloatingArrow
                ref={arrowRef}
                context={context}
                fill="var(--interactive-focus)"
                stroke="var(--interactive-focus)"
                strokeWidth={1}
                width={14}
                height={7}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}
