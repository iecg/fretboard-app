import { type Ref } from "react";
import { HelpCircle } from "lucide-react";
import styles from "./shared.module.css";

export type FieldHelpContent = {
  id: string;
  content: string;
};

export function FieldHelpHeader({
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
    <div className={styles["field-help-header"]}>
      <span className={styles["field-help-label"]}>{label}</span>
      {help ? (
        <div className={styles["field-help-wrapper"]} ref={helpContainerRef}>
          <button
            type="button"
            className={styles["field-help-trigger"]}
            aria-label={isHelpOpen ? `Hide help for ${label}` : `Show help for ${label}`}
            aria-expanded={isHelpOpen}
            aria-controls={`field-help-${help.id}`}
            onClick={onToggleHelp}
          >
            <HelpCircle className="icon" />
          </button>
          {isHelpOpen ? (
            <div
              id={`field-help-${help.id}`}
              className={styles["field-help-popover"]}
            >
              {help.content}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
