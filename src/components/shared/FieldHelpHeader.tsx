import { type Ref } from "react";
import styles from "./shared.module.css";

export type FieldHelpContent = {
  id: string;
  content: string;
};

/**
 * Renders the field's label. The popover help button has been retired —
 * help text now lives inline below the field control as a hint paragraph
 * (see each settings section). The remaining props are accepted for
 * API back-compat but are not used.
 */
export function FieldHelpHeader({
  label,
}: {
  label: string;
  help?: FieldHelpContent;
  isHelpOpen?: boolean;
  onToggleHelp?: () => void;
  helpContainerRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className={styles["field-help-header"]}>
      <span className={styles["field-help-label"]}>{label}</span>
    </div>
  );
}
