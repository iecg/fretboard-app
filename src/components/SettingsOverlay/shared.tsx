import { type ReactNode, type Ref } from "react";
import clsx from "clsx";
import { FieldHelpHeader, type FieldHelpContent } from "../shared/FieldHelpHeader";
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

export function OverlayFieldHeader({
  label,
  help,
  isHelpOpen,
  onToggleHelp,
  helpContainerRef,
}: {
  label: string;
  help?: FieldHelpContent;
  isHelpOpen: boolean;
  onToggleHelp: () => void;
  helpContainerRef?: Ref<HTMLDivElement>;
}) {
  return (
    <FieldHelpHeader
      label={label}
      help={help}
      isHelpOpen={isHelpOpen}
      onToggleHelp={onToggleHelp}
      helpContainerRef={helpContainerRef}
    />
  );
}
