import styles from "./Fretboard.module.css";

export interface FretboardSkeletonProps {
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
  // Approximate 24 frets evenly spaced for the skeleton
  const numFrets = 24;
  const fretSpacing = neckWidthPx / numFrets;
  const strings = Array.from({ length: numStrings });
  const frets = Array.from({ length: numFrets });

  return (
    <div className={styles["skeleton-container"]} aria-label="Loading fretboard">
      <svg width={neckWidthPx} height={neckHeight} className={styles["skeleton-svg"]}>
        {/* Wood background */}
        <rect width="100%" height="100%" fill="var(--fretboard-wood-mid)" />
        
        {/* Fret wires */}
        {frets.map((_, i) => (
          <line
            key={`skeleton-fret-${i}`}
            x1={i * fretSpacing}
            y1="0"
            x2={i * fretSpacing}
            y2="100%"
            stroke="var(--fret-wire-dark)"
            strokeWidth="2"
            opacity="0.3"
          />
        ))}

        {/* Strings */}
        {strings.map((_, i) => (
          <line
            key={`skeleton-string-${i}`}
            x1="0"
            y1={i * stringRowPx + stringRowPx / 2}
            x2="100%"
            y2={i * stringRowPx + stringRowPx / 2}
            stroke="var(--string-wire)"
            strokeWidth="1.5"
            opacity="0.5"
          />
        ))}
      </svg>
    </div>
  );
}
