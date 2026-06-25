import clsx from "clsx";
import styles from "./LoadingSkeleton.module.css";

function SkeletonBar({ size = "md", width }: { size?: "sm" | "md" | "lg"; width?: string }) {
  const sizeClass = size !== "md" ? styles[`bar--${size}`] : undefined;
  return <div className={clsx(styles.bar, sizeClass)} style={width ? { width } : undefined} />;
}





function ControlCardSkeleton({
  titleWidth,
  groups
}: {
  titleWidth: string;
  groups: { labelWidth: string; segments?: number; isDropdown?: boolean }[];
}) {
  return (
    <div className={styles["card-skeleton"]} aria-hidden="true">
      <div className={styles["card-skeleton__header"]}>
        <div className={styles["skel-header-row"]}>
          <div className={styles["skel-toggle"]} />
          <SkeletonBar size="md" width={titleWidth} />
        </div>
      </div>
      <div className={styles["card-skeleton__body"]}>
        <div className={styles["skel-controls-grid"]}>
          {groups.map((g, i) => (
            <div key={i} className={styles["skel-control-group"]} style={{ flex: g.segments ? g.segments : 1 }}>
              <SkeletonBar size="sm" width={g.labelWidth} />
              {g.isDropdown ? (
                <div className={styles["skel-dropdown"]} />
              ) : (
                <div className={styles["skel-segmented"]}>
                  {Array.from({ length: g.segments || 1 }).map((_, j) => (
                    <div key={j} className={styles["skel-segment"]} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ControlsPanelSkeleton({ mode }: { mode: "3col" | "split" | "stacked" }) {
  return (
    <div className={styles["controls-skeleton"]} data-mode={mode} aria-label="Loading controls" role="status">
      {/* SCALE CARD MOCKUP */}
      <ControlCardSkeleton 
        titleWidth="8rem" 
        groups={[
          { labelWidth: "4rem", isDropdown: true },
          { labelWidth: "3rem", segments: 5 }
        ]} 
      />
      {/* CHORD CARD MOCKUP */}
      <ControlCardSkeleton 
        titleWidth="9rem" 
        groups={[
          { labelWidth: "4.5rem", isDropdown: true },
          { labelWidth: "2.5rem", segments: 2 },
          { labelWidth: "6rem", isDropdown: true } // Lock to scale mock
        ]} 
      />
      {/* Third Card for 3col layout */}
      {mode === "3col" && (
        <ControlCardSkeleton 
          titleWidth="7rem" 
          groups={[
            { labelWidth: "5rem", isDropdown: true }
          ]} 
        />
      )}
    </div>
  );
}


