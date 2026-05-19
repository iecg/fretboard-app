import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useAtomValue } from 'jotai';
import { ANIMATION_DURATION_FAST } from '@fretflow/core';

import { scaleDegreeColorsEnabledAtom } from '../../store/atoms';
import { NotePill } from '../NotePill/NotePill';
import styles from './DegreeChipStrip.module.css';

export interface DegreeChip {
  note: string;
  internalNote: string;
  interval: string;
  inScale: boolean;
  isTonic?: boolean;
  scaleDegree?: string;
  degreeColor?: string;
}

export interface DegreeChipStripProps {
  scaleName: string;
  chips: DegreeChip[];
  hiddenNotes?: Set<string>;
  onChipToggle?: (internalNote: string) => void;
  /** Scale-owned color notes (blue notes, modal characteristic tones). */
  colorNotes?: Set<string>;
  className?: string;
  'aria-label'?: string;
  hideHeader?: boolean;
  /** When false, hides the chip list. Default true. */
  visible?: boolean;
  /** Rendered inside the header landmark, to the right of the scale name. */
  headerAction?: ReactNode;
}

export function DegreeChipStrip({
  scaleName,
  chips,
  hiddenNotes,
  onChipToggle,
  colorNotes,
  className,
  'aria-label': ariaLabel,
  hideHeader,
  visible = true,
  headerAction,
}: DegreeChipStripProps) {
  const degreeColorsEnabled = useAtomValue(scaleDegreeColorsEnabledAtom);
  const label = ariaLabel ?? `Scale degrees for ${scaleName}`;

  return (
    <section
      role="group"
      aria-label={label}
      className={clsx(styles['degree-chip-strip'], className)}
      data-scale-visible={visible ? 'true' : 'false'}
      data-degree-colors={degreeColorsEnabled ? 'true' : undefined}
    >
      {(!hideHeader || headerAction) && (
        <div className={styles['degree-chip-strip-header']}>
          {headerAction}
          {!hideHeader && scaleName}
        </div>
      )}
      <AnimatePresence initial={false}>
        {visible && (
          <motion.ul
            key="chip-list"
            className={styles['degree-chip-strip-list']}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION_FAST }}
          >
            {chips.map((chip, i) => {
              const isHidden = hiddenNotes?.has(chip.internalNote) ?? false;
              const isColorNote = colorNotes?.has(chip.internalNote) ?? false;
              return (
                <NotePill
                  key={`${chip.note}-${i}`}
                  note={chip.note}
                  interval={chip.interval}
                  ariaLabel={`${isHidden ? 'Show' : 'Hide'} ${chip.note}`}
                  pressed={isHidden}
                  onToggle={
                    onChipToggle ? () => onChipToggle(chip.internalNote) : undefined
                  }
                  itemClassName={styles['degree-chip-item']}
                  pillClassName={styles['degree-chip']}
                  noteClassName={styles['degree-chip-note']}
                  intervalClassName={styles['degree-chip-interval']}
                  itemStyle={
                    degreeColorsEnabled && chip.degreeColor
                      ? ({ '--degree-color': chip.degreeColor } as React.CSSProperties)
                      : undefined
                  }
                  itemData={{
                    'data-in-scale': chip.inScale ? 'true' : undefined,
                    'data-is-tonic': chip.isTonic ? 'true' : undefined,
                    'data-hidden': isHidden ? 'true' : undefined,
                    'data-is-color-note': isColorNote ? 'true' : undefined,
                    'data-scale-degree': degreeColorsEnabled ? chip.scaleDegree : undefined,
                  }}
                />
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}
