import clsx from "clsx";
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
  decrementSymbol?: string;
  incrementSymbol?: string;
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
  decrementSymbol,
  incrementSymbol,
}: FretRangeControlProps) {
  const isToolbar = layout === "toolbar" || layout === undefined;
  const isMobile = layout === "mobile";
  const sep = showSeparator ?? !isMobile;
  const labels = showLabels ?? !isToolbar;
  const dec = decrementSymbol ?? (isToolbar ? "◀" : "−");
  const inc = incrementSymbol ?? (isToolbar ? "▶" : "+");

  return (
    <div className={clsx(styles["fret-range-control"], styles[layout ?? "toolbar"])}>
      <div className={clsx(styles["fret-group"], styles["fret-start"])}>
        {labels && <span className={styles["fret-label"]}>Start</span>}
        <button
          type="button"
          className={styles["fret-btn"]}
          aria-label={`Decrease start fret${labels ? ` (${startFret})` : ""}`}
          onClick={() => onStartChange(Math.max(0, startFret - 1))}
          disabled={startFret <= 0}
        >
          {dec}
        </button>
        <span className={styles["fret-value"]}>{startFret}</span>
        <button
          type="button"
          className={styles["fret-btn"]}
          aria-label={`Increase start fret${labels ? ` (${startFret})` : ""}`}
          onClick={() => onStartChange(Math.min(endFret - 1, startFret + 1))}
          disabled={startFret >= endFret - 1}
        >
          {inc}
        </button>
      </div>
      {sep && <span className={styles["range-separator"]}>—</span>}
      <div className={clsx(styles["fret-group"], styles["fret-end"])}>
        {labels && <span className={styles["fret-label"]}>End</span>}
        <button
          type="button"
          className={styles["fret-btn"]}
          aria-label={`Decrease end fret${labels ? ` (${endFret})` : ""}`}
          onClick={() => onEndChange(Math.max(startFret + 1, endFret - 1))}
          disabled={endFret <= startFret + 1}
        >
          {dec}
        </button>
        <span className={styles["fret-value"]}>{endFret}</span>
        <button
          type="button"
          className={styles["fret-btn"]}
          aria-label={`Increase end fret${labels ? ` (${endFret})` : ""}`}
          onClick={() => onEndChange(Math.min(maxFret, endFret + 1))}
          disabled={endFret >= maxFret}
        >
          {inc}
        </button>
      </div>
    </div>
  );
}

export default FretRangeControl;
