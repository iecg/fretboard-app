import { memo } from "react";
import { NECK_BORDER } from "../../core/constants";
import styles from "./FretboardSVG.module.css";

interface FretNumbersRowProps {
  totalColumns: number;
  startFret: number;
  maxFret: number;
  neckWidthPx: number;
  fretColumnWidth: (fretIndex: number) => number;
}

export const FretNumbersRow = memo(({
  totalColumns,
  startFret,
  maxFret,
  neckWidthPx,
  fretColumnWidth,
}: FretNumbersRowProps) => {
  return (
    <div
      className={styles["fret-numbers-row"]}
      aria-hidden="true"
      style={{
        width: `${neckWidthPx + NECK_BORDER * 2}px`,
        paddingLeft: `${NECK_BORDER}px`,
      }}
    >
      {Array.from({ length: totalColumns + 1 }).map((_, idx) => {
        const fretIndex = startFret + idx;
        return (
          <span
            key={`fn-${fretIndex}`}
            className={styles["fret-number"]}
            style={{ width: `${fretColumnWidth(fretIndex)}px` }}
          >
            {fretIndex > 0 && fretIndex < maxFret ? fretIndex : ""}
          </span>
        );
      })}
    </div>
  );
});
FretNumbersRow.displayName = "FretNumbersRow";
