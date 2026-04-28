import { type ReactNode } from "react";
import clsx from "clsx";
import styles from "./SettingsOverlay.module.css";

export function OverlaySection({
  id,
  title,
  tone = "default",
  children,
}: {
  id: string;
  title: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <section
      className={clsx(
        styles["overlay-section-card"],
        tone === "danger" && styles["overlay-section-card--danger"],
      )}
      aria-labelledby={`settings-section-${id}`}
    >
      <div className={styles["overlay-section-heading"]}>
        <h2 id={`settings-section-${id}`} className={styles["overlay-section-title"]}>
          {title}
        </h2>
      </div>
      <div className={styles["overlay-section-body"]}>{children}</div>
    </section>
  );
}

export function OverlayFieldHeader({ label }: { label: string }) {
  return (
    <div className={styles["overlay-field-header"]}>
      <span className={styles["overlay-field-label"]}>{label}</span>
    </div>
  );
}
