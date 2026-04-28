import { type Ref } from "react";
import styles from "./shared.module.css";

export type FieldHelpContent = {
  id: string;
  content: string;
};

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
