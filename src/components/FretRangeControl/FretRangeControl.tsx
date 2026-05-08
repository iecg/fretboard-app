import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import { StepperShell } from "../StepperShell/StepperShell";
import styles from "./FretRangeControl.module.css";

export interface FretRangeControlProps {
  startFret: number;
  endFret: number;
  onStartChange: (fret: number) => void;
  onEndChange: (fret: number) => void;
  maxFret: number;
  layout?: "toolbar" | "mobile" | "dashboard";
  showSeparator?: boolean;
  showLabels?: boolean;
  compact?: boolean;
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
  compact,
}: FretRangeControlProps) {
  const isToolbar = layout === "toolbar" || layout === undefined;
  const sep = showSeparator ?? isToolbar;
  const labels = showLabels ?? !isToolbar;

  return (
    <div className={clsx(styles["fret-range-control"], styles[layout ?? "toolbar"])} data-compact={compact ? "true" : undefined}>
      <div className={clsx(styles["fret-group"], styles["fret-start"])}>
        {labels && <span className={styles["fret-label"]}>Start</span>}
        <StepperShell
          className={styles["fret-stepper"]}
          role="group"
          aria-label="Start fret"
        >
          <motion.button
            type="button"
            className={styles["fret-btn"]}
            aria-label={`Decrease start fret${labels ? ` (${startFret})` : ""}`}
            onClick={() => onStartChange(Math.max(0, startFret - 1))}
            disabled={startFret <= 0}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
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
                transition={{
                  y: { type: "spring", stiffness: 400, damping: 28 },
                  opacity: { duration: 0.15 }
                }}
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
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Plus className={styles["fret-icon"]} aria-hidden="true" />
          </motion.button>
        </StepperShell>
      </div>
      {sep && <span className={styles["range-separator"]}>—</span>}
      <div className={clsx(styles["fret-group"], styles["fret-end"])}>
        {labels && <span className={styles["fret-label"]}>End</span>}
        <StepperShell
          className={styles["fret-stepper"]}
          role="group"
          aria-label="End fret"
        >
          <motion.button
            type="button"
            className={styles["fret-btn"]}
            aria-label={`Decrease end fret${labels ? ` (${endFret})` : ""}`}
            onClick={() => onEndChange(Math.max(startFret + 1, endFret - 1))}
            disabled={endFret <= startFret + 1}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
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
                transition={{
                  y: { type: "spring", stiffness: 400, damping: 28 },
                  opacity: { duration: 0.15 }
                }}
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
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Plus className={styles["fret-icon"]} aria-hidden="true" />
          </motion.button>
        </StepperShell>
      </div>
    </div>
  );
}

export default FretRangeControl;
