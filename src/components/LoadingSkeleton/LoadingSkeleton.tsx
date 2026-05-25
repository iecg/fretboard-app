import clsx from "clsx";
import styles from "./LoadingSkeleton.module.css";

function SkeletonBar({ size = "md", width }: { size?: "sm" | "md" | "lg"; width?: string }) {
  const sizeClass = size !== "md" ? styles[`bar--${size}`] : undefined;
  return <div className={clsx(styles.bar, sizeClass)} style={width ? { width } : undefined} />;
}

function CardSkeleton({ rows = 3, children }: { rows?: number; children?: React.ReactNode }) {
  return (
    <div className={styles["card-skeleton"]} aria-hidden="true">
      <div className={styles["card-skeleton__header"]}>
        <div className={styles.bone} />
      </div>
      <div className={styles["card-skeleton__body"]}>
        {children ?? Array.from({ length: rows }, (_, i) => (
          <SkeletonBar key={i} width={i === rows - 1 ? "60%" : undefined} />
        ))}
      </div>
    </div>
  );
}

export function ControlsPanelSkeleton({ mode }: { mode: "3col" | "split" | "stacked" }) {
  return (
    <div className={styles["controls-skeleton"]} data-mode={mode} aria-label="Loading controls" role="status">
      <CardSkeleton rows={4} />
      <CardSkeleton rows={5} />
      <CardSkeleton>
        <div className={styles["cof-skeleton"]}>
          <div className={clsx(styles.circle)} style={{ width: "min(14rem, 100%)" }} />
        </div>
      </CardSkeleton>
    </div>
  );
}

