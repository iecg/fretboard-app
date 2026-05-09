import { useState } from 'react';
import { FloatingPortal, FloatingArrow } from '@floating-ui/react';
import { motion, AnimatePresence } from 'motion/react';
import { useAtom } from 'jotai';
import { coachmarkSettingsDismissedAtom } from '../../store/atoms';
import { Coachmark } from '../shared/Tooltip';
import { useFloatingTooltipBase } from '../shared/Tooltip/useFloatingTooltipBase';
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from '../../core/constants';
import tooltipStyles from '../shared/Tooltip/Tooltip.module.css';

const SECTION_TITLES = ['View', 'Instrument', 'Appearance', 'Notation', 'Chord Layout', 'Reset'];

export interface SettingsTooltipProps {
  /** The gear <button> element (trigger). */
  children: React.ReactElement;
}

export function SettingsTooltip({ children }: SettingsTooltipProps) {
  const [dismissed, setDismissed] = useAtom(coachmarkSettingsDismissedAtom);
  const [open, setOpen] = useState(false);

  const {
    refs,
    floatingStyles,
    context,
    arrowRef,
    getReferenceProps,
    getFloatingProps,
  } = useFloatingTooltipBase({ open, onOpenChange: setOpen, placement: 'bottom', role: 'tooltip' });

  // Attach the tooltip's reference to a transparent wrapper so hover/focus events
  // reach the tooltip hook while Coachmark manages the same trigger for its own floating.
  // display:contents collapses the wrapper box so layout is unaffected.
  return (
    <>
      {/* Tooltip reference wrapper — display:contents means no layout impact */}
      <span ref={refs.setReference} style={{ display: 'contents' }} {...getReferenceProps()}>
        <Coachmark
          dismissed={dismissed}
          onDismiss={() => setDismissed(true)}
          placement="bottom"
          content={<span>Tap the gear to explore View, Notation, and more.</span>}
        >
          {children}
        </Coachmark>
      </span>

      {/* Hover / focus tooltip — only shown when coachmark is dismissed */}
      <AnimatePresence>
        {open && dismissed && (
          <FloatingPortal>
            <motion.div
              // eslint-disable-next-line react-hooks/refs
              ref={refs.setFloating}
              role="tooltip"
              style={floatingStyles}
              className={tooltipStyles.tooltip}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
              {...getFloatingProps()}
            >
              <p className={tooltipStyles['tooltip-label']}>Settings</p>
              <ul className={tooltipStyles['tooltip-sections']} aria-label="Settings sections">
                {SECTION_TITLES.map((title) => (
                  <li key={title} className={tooltipStyles['tooltip-section']}>
                    {title}
                  </li>
                ))}
              </ul>
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
