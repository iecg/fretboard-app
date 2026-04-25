import { type ReactNode, type Ref } from "react";
import clsx from "clsx";
import { HelpCircle } from "lucide-react";
import { type FieldHelp } from "./types";
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
  help?: FieldHelp;
  isHelpOpen: boolean;
  onToggleHelp: () => void;
  helpContainerRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className={styles["overlay-field-header"]}>
      <span className={styles["overlay-field-label"]}>{label}</span>
      {help ? (
        <div className={styles["overlay-field-help"]} ref={helpContainerRef}>
          <button
            type="button"
            className={styles["overlay-help-trigger"]}
            aria-label={
              isHelpOpen ? `Hide help for ${label}` : `Show help for ${label}`
            }
            aria-expanded={isHelpOpen}
            aria-controls={`settings-help-${help.id}`}
            onClick={onToggleHelp}
          >
            <HelpCircle className="icon" />
          </button>
          {isHelpOpen ? (
            <div
              id={`settings-help-${help.id}`}
              className={styles["overlay-help-popover"]}
            >
              {help.content}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
