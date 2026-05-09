import React, { useState } from 'react';
import { FloatingPortal, FloatingArrow, type Placement } from '@floating-ui/react';
import { motion, AnimatePresence } from 'motion/react';
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from '../../../core/constants';
import { useFloatingTooltipBase } from './useFloatingTooltipBase';
import styles from './Tooltip.module.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = React.ReactElement<Record<string, any>>;

interface TooltipProps {
  /** Single trigger element — cloned with reference props attached. */
  children: AnyElement;
  /** Tooltip body content. If undefined/null, nothing renders. */
  content: React.ReactNode;
  /** Preferred placement; Floating UI flips as needed. Defaults to 'top'. */
  placement?: Placement;
  /** Extra class name applied to the floating container. */
  className?: string;
}

export function Tooltip({ children, content, placement, className }: TooltipProps) {
  const [open, setOpen] = useState(false);

  const {
    refs,
    floatingStyles,
    context,
    arrowRef,
    getReferenceProps,
    getFloatingProps,
  } = useFloatingTooltipBase({ open, onOpenChange: setOpen, placement, role: 'tooltip' });

  // refs.setReference / refs.setFloating are callback refs (functions) returned by Floating UI's
  // useFloating(). Passing them as JSX ref props during render is the documented Floating UI
  // pattern. The react-hooks/refs rule fires here because these originate on a refs object;
  // the eslint-disable comments suppress the false-positive on each usage site.
  const setReference = refs.setReference;
  const setFloating = refs.setFloating;

  // Clone the single trigger child, attaching the floating callback-ref and interaction props.
  // eslint-disable-next-line react-hooks/refs
  const trigger = React.cloneElement(children, {
    // eslint-disable-next-line react-hooks/refs
    ref: setReference,
    ...getReferenceProps(),
  });

  return (
    <>
      {trigger}
      <AnimatePresence>
        {open && content != null && (
          <FloatingPortal>
            <motion.div
              // eslint-disable-next-line react-hooks/refs
              ref={setFloating}
              style={floatingStyles}
              className={[styles.tooltip, className].filter(Boolean).join(' ')}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
              {...getFloatingProps()}
            >
              {content}
              <FloatingArrow
                ref={arrowRef}
                context={context}
                fill="var(--surface-overlay)"
                stroke="var(--surface-overlay-border)"
                strokeWidth={1}
                width={14}
                height={7}
              />
            </motion.div>
          </FloatingPortal>
        )}
      </AnimatePresence>
    </>
  );
}
