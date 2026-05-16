import { ProgressionControls } from "../ProgressionControls/ProgressionControls";
import styles from "./ProgressionTab.module.css";

export function ProgressionTab() {
  return (
    <div className={styles.root} data-inspector-tab="progression">
      <ProgressionControls />
    </div>
  );
}
