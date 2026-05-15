import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import styles from "./ChordTab.module.css";

export function ChordTab() {
  return (
    <div className={styles.root} data-inspector-tab="chord">
      <ChordOverlayControls />
    </div>
  );
}
