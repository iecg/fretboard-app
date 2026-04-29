import { Minus, Plus } from "lucide-react";
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
          <button
            type="button"
            className={styles["fret-btn"]}
            aria-label={`Decrease start fret${labels ? ` (${startFret})` : ""}`}
            onClick={() => onStartChange(Math.max(0, startFret - 1))}
            disabled={startFret <= 0}
          >
            <Minus className={styles["fret-icon"]} aria-hidden="true" />
          </button>
          <span className={styles["fret-value"]}>{startFret}</span>
          <button
            type="button"
            className={styles["fret-btn"]}
            aria-label={`Increase start fret${labels ? ` (${startFret})` : ""}`}
            onClick={() => onStartChange(Math.min(endFret - 1, startFret + 1))}
            disabled={startFret >= endFret - 1}
          >
            <Plus className={styles["fret-icon"]} aria-hidden="true" />
          </button>
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
          <button
            type="button"
            className={styles["fret-btn"]}
            aria-label={`Decrease end fret${labels ? ` (${endFret})` : ""}`}
            onClick={() => onEndChange(Math.max(startFret + 1, endFret - 1))}
            disabled={endFret <= startFret + 1}
          >
            <Minus className={styles["fret-icon"]} aria-hidden="true" />
          </button>
          <span className={styles["fret-value"]}>{endFret}</span>
          <button
            type="button"
            className={styles["fret-btn"]}
            aria-label={`Increase end fret${labels ? ` (${endFret})` : ""}`}
            onClick={() => onEndChange(Math.min(maxFret, endFret + 1))}
            disabled={endFret >= maxFret}
          >
            <Plus className={styles["fret-icon"]} aria-hidden="true" />
          </button>
        </StepperShell>
      </div>
    </div>
  );
}

export default FretRangeControl;
