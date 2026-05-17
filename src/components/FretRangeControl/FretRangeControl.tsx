import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import { StepperShell } from "../StepperShell/StepperShell";
import {
  SPRING_TAP,
  STEPPER_VALUE_POP_TRANSITION,
  WHILE_TAP_BTN,
} from "@fretflow/core";
import styles from "./FretRangeControl.module.css";

export interface FretRangeControlProps {
  startFret: number;
  endFret: number;
  onStartChange: (fret: number) => void;
  onEndChange: (fret: number) => void;
  maxFret: number;
  layout?: "toolbar" | "mobile" | "dashboard" | "inline";
  showSeparator?: boolean;
  showLabels?: boolean;
}

export function FretRangeControl({
  startFret,
  endFret,
  onStartChange,
  onEndChange,
  maxFret,
  layout,
  showSeparator,
  showLabels,
}: FretRangeControlProps) {
  const isToolbar = layout === "toolbar" || layout === undefined;
  const isInline = layout === "inline";
  const sep = showSeparator ?? isToolbar;
  const labels = showLabels ?? (!isToolbar && !isInline);

  const startButtons = (
    <>
      <motion.button
        type="button"
        className={styles["fret-btn"]}
        aria-label={`Decrease start fret${labels ? ` (${startFret})` : ""}`}
        onClick={() => onStartChange(Math.max(0, startFret - 1))}
        disabled={startFret <= 0}
        whileTap={WHILE_TAP_BTN}
        transition={SPRING_TAP}
      >
        <Minus className={styles["fret-icon"]} aria-hidden="true" />
      </motion.button>
      <div className={styles["fret-value-slot"]}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={startFret}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={STEPPER_VALUE_POP_TRANSITION}
            className={styles["fret-value"]}
          >
            {startFret}
          </motion.span>
        </AnimatePresence>
      </div>
      <motion.button
        type="button"
        className={styles["fret-btn"]}
        aria-label={`Increase start fret${labels ? ` (${startFret})` : ""}`}
        onClick={() => onStartChange(Math.min(endFret - 1, startFret + 1))}
        disabled={startFret >= endFret - 1}
        whileTap={WHILE_TAP_BTN}
        transition={SPRING_TAP}
      >
        <Plus className={styles["fret-icon"]} aria-hidden="true" />
      </motion.button>
    </>
  );

  const endButtons = (
    <>
      <motion.button
        type="button"
        className={styles["fret-btn"]}
        aria-label={`Decrease end fret${labels ? ` (${endFret})` : ""}`}
        onClick={() => onEndChange(Math.max(startFret + 1, endFret - 1))}
        disabled={endFret <= startFret + 1}
        whileTap={WHILE_TAP_BTN}
        transition={SPRING_TAP}
      >
        <Minus className={styles["fret-icon"]} aria-hidden="true" />
      </motion.button>
      <div className={styles["fret-value-slot"]}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={endFret}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={STEPPER_VALUE_POP_TRANSITION}
            className={styles["fret-value"]}
          >
            {endFret}
          </motion.span>
        </AnimatePresence>
      </div>
      <motion.button
        type="button"
        className={styles["fret-btn"]}
        aria-label={`Increase end fret${labels ? ` (${endFret})` : ""}`}
        onClick={() => onEndChange(Math.min(maxFret, endFret + 1))}
        disabled={endFret >= maxFret}
        whileTap={WHILE_TAP_BTN}
        transition={SPRING_TAP}
      >
        <Plus className={styles["fret-icon"]} aria-hidden="true" />
      </motion.button>
    </>
  );

  if (isInline) {
    const fillLeft = maxFret > 0 ? (startFret / maxFret) * 100 : 0;
    const fillWidth = maxFret > 0 ? ((endFret - startFret) / maxFret) * 100 : 100;

    return (
      <StepperShell
        className={clsx(styles["fret-range-control"], styles.inline)}
        role="group"
        aria-label="Fret Range"
      >
        {startButtons}
        <div className={styles["range-bar"]} aria-hidden="true">
          <div
            className={styles["range-fill"]}
            style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
          />
        </div>
        {endButtons}
      </StepperShell>
    );
  }

  return (
    <div
      role="group"
      aria-label="Fret Range"
      className={clsx(styles["fret-range-control"], styles[layout ?? "toolbar"])}
    >
      <div className={clsx(styles["fret-group"], styles["fret-start"])}>
        {labels && <span className={styles["fret-sublabel"]}>Start</span>}
        <StepperShell
          className={styles["fret-stepper"]}
          role="group"
          aria-label="Start fret"
        >
          {startButtons}
        </StepperShell>
      </div>
      {sep && <span className={styles["range-separator"]}>—</span>}
      <div className={clsx(styles["fret-group"], styles["fret-end"])}>
        {labels && <span className={styles["fret-sublabel"]}>End</span>}
        <StepperShell
          className={styles["fret-stepper"]}
          role="group"
          aria-label="End fret"
        >
          {endButtons}
        </StepperShell>
      </div>
    </div>
  );
}

export default FretRangeControl;
