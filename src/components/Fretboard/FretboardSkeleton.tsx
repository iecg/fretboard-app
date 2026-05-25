import styles from "./Fretboard.module.css";

interface FretboardSkeletonProps {
  neckWidthPx: number;
  neckHeight: number;
  numStrings: number;
  stringRowPx: number;
}

export function FretboardSkeleton({
  neckWidthPx,
  neckHeight,
  numStrings,
  stringRowPx,
}: FretboardSkeletonProps) {
  const strings = Array.from({ length: numStrings });

  return (
    <div
      className={styles["skeleton-container"]}
      style={{ width: neckWidthPx, height: neckHeight }}
      aria-hidden="true"
    >
      <svg width={neckWidthPx} height={neckHeight} className={styles["skeleton-svg"]}>
        <rect width="100%" height="100%" fill="var(--neutral-800)" />
        {strings.map((_, i) => (
          <line
            key={`skeleton-string-${i}`}
            x1="0"
            y1={i * stringRowPx + stringRowPx / 2}
            x2="100%"
            y2={i * stringRowPx + stringRowPx / 2}
            stroke="var(--neutral-600)"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}
